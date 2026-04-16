importScripts("../utils/storage.js", "../utils/api.js", "../utils/logger.js");

const ALARM_NAME = "jobpilot-queue-poll";
const POLL_INTERVAL_MIN = 0.25;
const JOB_COOLDOWN_MS = 3000;
const TAB_LOAD_TIMEOUT_MS = 25000;
const CONTENT_SCRIPT_TIMEOUT_MS = 90000;

const state = {
  processing: false,
  currentApp: null,
  queueSize: 0,
  processed: 0,
  failed: 0,
  skipped: 0,
  resumeData: null,
  lastPoll: null,
  lastError: null,
};

// ── Lifecycle ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  logger.info("Extension installed/updated — initializing queue poller");
  ensureAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  logger.info("Browser started — initializing queue poller");
  ensureAlarm();
});

function ensureAlarm() {
  chrome.alarms.get(ALARM_NAME, (existing) => {
    if (!existing) {
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: 0.15,
        periodInMinutes: POLL_INTERVAL_MIN,
      });
      logger.info(
        `Alarm "${ALARM_NAME}" created (every ${POLL_INTERVAL_MIN * 60}s)`
      );
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) pollQueue();
});

// ── Message Handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg)
    .then(sendResponse)
    .catch((e) => sendResponse({ error: e.message }));
  return true;
});

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  logger.info("External message:", msg.action);
  handleMessage(msg)
    .then(sendResponse)
    .catch((e) => sendResponse({ error: e.message }));
  return true;
});

async function handleMessage(msg) {
  switch (msg.action) {
    case "ping":
      return {
        connected: true,
        extensionId: chrome.runtime.id,
        version: chrome.runtime.getManifest().version,
        ...getSnapshot(),
      };

    case "getStatus":
      return getSnapshot();

    case "startApplying":
    case "triggerPoll":
      pollQueue();
      return { triggered: true, ...getSnapshot() };

    case "googleLogin":
      return await handleGoogleLogin();

    case "googleLogout":
      return await handleGoogleLogout();

    default:
      return { error: "unknown_action" };
  }
}

async function handleGoogleLogin() {
  const accessToken = await getGoogleAccessTokenInteractive();
  const data = await apiCall("/auth/google/access-token", {
    method: "POST",
    body: JSON.stringify({ accessToken }),
  });
  return { token: data.token, user: data.user };
}

async function handleGoogleLogout() {
  const tokenResult = await chrome.storage.local.get("googleAccessToken");
  const accessToken = tokenResult.googleAccessToken;
  if (accessToken) {
    await new Promise((resolve) =>
      chrome.identity.removeCachedAuthToken({ token: accessToken }, resolve)
    );
    await chrome.storage.local.remove("googleAccessToken");
  }
  return { ok: true };
}

async function getGoogleAccessTokenInteractive() {
  const cached = await chrome.storage.local.get("googleAccessToken");
  if (cached.googleAccessToken) return cached.googleAccessToken;

  const token = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (t) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!t) {
        reject(new Error("No Google token returned"));
      } else {
        resolve(t);
      }
    });
  });

  await chrome.storage.local.set({ googleAccessToken: token });
  return token;
}

function getSnapshot() {
  return {
    processing: state.processing,
    queueSize: state.queueSize,
    processed: state.processed,
    failed: state.failed,
    skipped: state.skipped,
    currentJob: state.currentApp
      ? {
          id: state.currentApp._id,
          title: state.currentApp.jobId?.title || "Unknown",
          platform:
            state.currentApp.platform || state.currentApp.jobId?.platform,
        }
      : null,
    lastPoll: state.lastPoll,
    lastError: state.lastError,
  };
}

// ── Queue Polling ────────────────────────────────────────────────────────────

async function pollQueue() {
  if (state.processing) return;

  const token = await getAuthToken();
  if (!token) return;

  state.lastPoll = Date.now();

  try {
    const data = await getQueuedApplications();
    const apps = data.data || [];
    state.queueSize = apps.length;
    state.lastError = null;

    if (apps.length > 0) {
      logger.info(
        `Poll found ${apps.length} queued jobs — starting processor`
      );
      await processQueue(apps);
    }
  } catch (err) {
    state.lastError = err.message;
    logger.error("Poll failed:", err.message);
  }
}

// ── Queue Processor ──────────────────────────────────────────────────────────

async function processQueue(applications) {
  if (state.processing) return;
  state.processing = true;
  state.processed = 0;
  state.failed = 0;
  state.skipped = 0;

  try {
    await loadResumeData();

    const total = applications.length;
    broadcast(`Processing ${total} job(s)`, 0, total);

    for (let i = 0; i < total; i++) {
      const app = applications[i];
      state.currentApp = app;
      state.queueSize = total - i;

      const jobTitle = app.jobId?.title || "Unknown";
      const jobUrl = app.jobId?.applicationUrl;
      const platform = app.jobId?.platform || app.platform;

      const log = logger.withContext({ jobId: app._id, platform });

      log.info(`[${i + 1}/${total}] ${jobTitle}`);
      broadcast(`Applying: ${jobTitle}`, i + 1, total);

      if (!jobUrl) {
        log.step("validate", "failed", "No application URL");
        await safeStatusUpdate(app._id, "failed", "No application URL");
        state.failed++;
        continue;
      }

      try {
        const result = await processOneJob(app, jobUrl, platform, log);
        if (result.success) state.processed++;
        else if (result.skip) state.skipped++;
        else state.failed++;
      } catch (err) {
        log.error("Process error:", err.message);
        await safeStatusUpdate(app._id, "failed", err.message);
        state.failed++;
      }

      if (i < total - 1) await delay(JOB_COOLDOWN_MS);
    }

    broadcast(
      `Done: ${state.processed} applied, ${state.failed} failed, ${state.skipped} skipped`,
      total,
      total
    );
    logger.info(
      `Queue complete — applied:${state.processed} failed:${state.failed} skipped:${state.skipped}`
    );
  } finally {
    state.processing = false;
    state.currentApp = null;
    state.queueSize = 0;
  }
}

// ── Single Job Processor ─────────────────────────────────────────────────────

async function processOneJob(application, jobUrl, platform, log) {
  await safeStatusUpdate(application._id, "in_progress");
  log.step("status", "in_progress");

  const tab = await chrome.tabs.create({ url: jobUrl, active: false });
  log.info(`Tab ${tab.id} opened`);

  try {
    const isLinkedInJob = /linkedin\.com/i.test(jobUrl);
    if (isLinkedInJob) {
      await waitForLinkedInTabSettled(tab.id, TAB_LOAD_TIMEOUT_MS);
    } else {
      await waitForTabComplete(tab.id, TAB_LOAD_TIMEOUT_MS);
    }
    log.step("tabLoad", "complete");

    await delay(2500);

    const isNaukri = /naukri\.com/i.test(jobUrl);
    const isLinkedIn = /linkedin\.com/i.test(jobUrl);

    if (isNaukri) {
      log.step("inject", "naukri");
      await injectScripts(tab.id, [
        "utils/dom.js",
        "utils/formFiller.js",
        "content-scripts/naukri.js",
      ]);
    } else if (isLinkedIn) {
      log.step("inject", "linkedin");
      await injectScripts(tab.id, [
        "utils/dom.js",
        "utils/formFiller.js",
        "content-scripts/linkedin.js",
      ]);
    } else {
      log.step("validate", "skipped", "Unsupported platform");
      await safeStatusUpdate(
        application._id,
        "skipped",
        "Unsupported platform"
      );
      return { success: false, skip: true };
    }

    await delay(500);

    // ── Phase 1: Content script apply attempt (with retry) ──
    let csResult;
    try {
      csResult = await sendMessageWithRetry(
        tab.id,
        { action: "applyToJob", resumeData: state.resumeData },
        CONTENT_SCRIPT_TIMEOUT_MS,
        isLinkedIn ? 4 : 1
      );
      log.step(
        "contentScript",
        csResult?.success ? "success" : "failure",
        JSON.stringify(csResult)
      );
    } catch (msgErr) {
      log.warn(`sendMessage error: ${msgErr.message}`);
      log.step("contentScript", "error", msgErr.message);
      csResult = null;
    }

    // ── Phase 2: If content script reported success, trust it ──
    if (csResult?.success) {
      log.step("decision", "applied", `CS reported success: ${csResult.message}`);
      await safeStatusUpdate(
        application._id,
        "applied",
        null,
        csResult.message || "Applied successfully"
      );
      return { success: true };
    }

    // ── Phase 3: Content script failed or no response — run background verification ──
    log.info("CS did not confirm success — running background verification");

    await delay(4000);

    const verified = await verifyApplicationOnPage(tab.id, platform, log);
    if (verified.success) {
      log.step("decision", "applied", `Background verified: ${verified.reason}`);
      await safeStatusUpdate(
        application._id,
        "applied",
        null,
        `bg_verified: ${verified.reason}`
      );
      return { success: true };
    }

    // ── Phase 4: Extended recovery for Naukri redirects ──
    if (isNaukri || !csResult) {
      log.info("Running extended recovery checks");
      const recovered = await attemptRecovery(tab.id, platform, log);
      if (recovered.success) {
        log.step("decision", "applied", `Recovery: ${recovered.message}`);
        await safeStatusUpdate(
          application._id,
          "applied",
          null,
          `recovery: ${recovered.message}`
        );
        return { success: true };
      }
    }

    // ── Phase 5: Truly failed ──
    const errorMsg =
      csResult?.error || verified.reason || "Apply could not be verified";
    const finalStatus = csResult?.skip ? "skipped" : "failed";
    log.step("decision", finalStatus, errorMsg);
    await safeStatusUpdate(application._id, finalStatus, errorMsg);
    return { success: false, skip: csResult?.skip };
  } finally {
    try {
      await chrome.tabs.remove(tab.id);
    } catch {}
  }
}

// ── Shared Success Detection Constants ────────────────────────────────────────

const NAUKRI_URL_SUCCESS_PATTERNS = [
  "/myapply/saveapply",
  "multiapplyresp",
  "/applied",
  "/thankjob",
  "/apply/confirmation",
  "applystatus=success",
];

/**
 * Injected into the tab via executeScript. Checks text, DOM, buttons, and
 * dialogs for any sign the application was submitted. Returns a result
 * object or null.
 */
function probePageForSuccess() {
  const text = (document.body?.innerText || "").toLowerCase();
  const successPhrases = [
    "application submitted",
    "your application was sent",
    "already applied",
    "successfully applied",
    "application sent",
    "you have already applied",
    "applied successfully",
    "congratulations",
    "application was submitted",
    "your application has been submitted",
    "application received",
  ];
  for (const phrase of successPhrases) {
    if (text.includes(phrase)) return { match: "text", detail: phrase };
  }

  if (
    document.querySelector(
      ".already-applied, [class*='alreadyApplied'], " +
        "[class*='styles_already-applied'], " +
        ".artdeco-inline-feedback--success, " +
        "[class*='post-apply'], .jpac-modal-confirm"
    )
  ) {
    return { match: "dom", detail: "success_element_found" };
  }

  const applyBtns = document.querySelectorAll(
    "#apply-button, .apply-button, [class*='apply-btn'], [class*='applyButton']"
  );
  for (const btn of applyBtns) {
    if (btn.textContent.toLowerCase().includes("applied")) {
      return { match: "button", detail: "button_says_applied" };
    }
  }

  const dialogs = document.querySelectorAll(
    ".artdeco-modal, [role='dialog']"
  );
  for (const d of dialogs) {
    const dt = d.textContent.toLowerCase();
    if (
      dt.includes("application submitted") ||
      dt.includes("application was sent")
    ) {
      return { match: "dialog", detail: "dialog_confirms_submit" };
    }
  }

  return null;
}

function checkUrlForSuccess(url) {
  for (const pattern of NAUKRI_URL_SUCCESS_PATTERNS) {
    if (url.includes(pattern)) {
      return { success: true, reason: `url_match:${pattern}` };
    }
  }
  return null;
}

// ── Background Page Verification ─────────────────────────────────────────────

async function verifyApplicationOnPage(tabId, platform, log) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = (tab.url || "").toLowerCase();
    log.info(`Verify: tab URL = ${url}`);

    const urlMatch = checkUrlForSuccess(url);
    if (urlMatch) return urlMatch;

    const [probe] = await chrome.scripting.executeScript({
      target: { tabId },
      func: probePageForSuccess,
    });

    if (probe?.result) {
      const r = probe.result;
      const reason = `${r.match}:${r.detail}`;
      log.info(`Verify: page probe found — ${reason}`);
      return { success: true, reason };
    }

    log.info("Verify: no success signal on page");
    return { success: false, reason: "no_signal" };
  } catch (err) {
    if (platform === "naukri") {
      log.info(
        `Verify: tab inaccessible (${err.message}) — Naukri redirect likely succeeded`
      );
      return { success: true, reason: "tab_gone_naukri_redirect" };
    }
    log.warn(`Verify: tab error (${err.message})`);
    return { success: false, reason: `tab_error:${err.message}` };
  }
}

// ── Extended Recovery ────────────────────────────────────────────────────────

async function attemptRecovery(tabId, platform, log) {
  const MAX_ATTEMPTS = 5;
  const WAIT_MS = 3000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await delay(WAIT_MS);

    try {
      const tab = await chrome.tabs.get(tabId);
      const url = (tab.url || "").toLowerCase();
      log.info(`Recovery ${attempt + 1}/${MAX_ATTEMPTS}: URL = ${url}`);

      const urlMatch = checkUrlForSuccess(url);
      if (urlMatch) return { success: true, message: urlMatch.reason };

      if (tab.status === "complete") {
        const [probe] = await chrome.scripting.executeScript({
          target: { tabId },
          func: probePageForSuccess,
        });

        if (probe?.result) {
          return { success: true, message: "page_content_success" };
        }
      }
    } catch (tabErr) {
      log.info(`Recovery: tab gone (${tabErr.message})`);
      return { success: true, message: "tab_closed_after_apply" };
    }
  }

  return {
    success: false,
    message: "recovery_exhausted",
    error: "No success signal after extended recovery",
  };
}

// ── Resume Data ──────────────────────────────────────────────────────────────

async function loadResumeData() {
  try {
    const resp = await getResumeDataFromApi();
    state.resumeData = resp.data || null;
    if (state.resumeData) {
      await setStoredResumeData(state.resumeData);
      logger.info("Resume data loaded:", state.resumeData.name);
    }
  } catch (e) {
    const cached = await getStoredResumeData();
    if (cached) {
      state.resumeData = cached;
      logger.info("Using cached resume data");
    } else {
      logger.warn("No resume data available:", e.message);
    }
  }
}

// ── Script Injection ─────────────────────────────────────────────────────────

async function injectScripts(tabId, files) {
  for (const file of files) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [file],
      });
    } catch (e) {
      logger.warn(`Inject ${file} failed: ${e.message}`);
    }
  }
}

// ── Messaging ────────────────────────────────────────────────────────────────

function sendMessageWithTimeout(tabId, message, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Content script timeout")),
      timeoutMs
    );

    chrome.tabs.sendMessage(tabId, message, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

async function sendMessageWithRetry(tabId, message, timeoutMs, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendMessageWithTimeout(tabId, message, timeoutMs);
      return result;
    } catch (err) {
      const isConnectionError =
        err.message.includes("Receiving end does not exist") ||
        err.message.includes("Could not establish connection");

      if (isConnectionError && attempt < maxRetries) {
        logger.warn(
          `sendMessage attempt ${attempt}/${maxRetries} failed (connection) — retrying in ${attempt * 1500}ms`
        );
        await delay(attempt * 1500);
        continue;
      }
      throw err;
    }
  }
}

// ── Status Update ────────────────────────────────────────────────────────────

async function safeStatusUpdate(appId, status, errorMessage, reason) {
  try {
    await updateApplicationStatus(appId, status, errorMessage, reason);
    logger.info(`Status updated: ${appId} → ${status}`);
  } catch (e) {
    logger.error(`Status update FAILED (${appId} → ${status}):`, e.message);
  }
}

// ── Tab Load ─────────────────────────────────────────────────────────────────

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);

    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

/** LinkedIn SPA: first "complete" can be shell-only; wait for real linkedin.com URL. */
async function waitForLinkedInTabSettled(tabId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const t = await chrome.tabs.get(tabId);
      const url = t.url || "";
      if (
        t.status === "complete" &&
        /linkedin\.com/i.test(url) &&
        !url.startsWith("chrome://")
      ) {
        return;
      }
    } catch (_) {}
    await delay(120);
  }
}

// ── Broadcast ────────────────────────────────────────────────────────────────

function broadcast(message, current, total) {
  chrome.runtime
    .sendMessage({ type: "progress", message, current, total })
    .catch(() => {});
}

// ── Utils ────────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
