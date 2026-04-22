importScripts("../utils/storage.js", "../utils/api.js", "../utils/logger.js");

const ALARM_NAME = "jobpilot-queue-poll";
const POLL_INTERVAL_MIN = 0.25;
const JOB_COOLDOWN_MS = 3000;
const TAB_LOAD_TIMEOUT_MS = 25000;
const CONTENT_SCRIPT_TIMEOUT_MS = 90000;

/** Same key as Naukri page `localStorage` — read via executeScript before closing tab. */
const NAUKRI_DEBUG_LS_KEY = "jobpilot_naukri_debug";

/** Set in `processOneJob` finally when debug tab is preserved; `processQueue` stops the batch. */
let _naukriDebugStopQueueAfterJob = false;

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

    case "autofillCurrentTab":
      return await handleAutofillCurrentTab();

    case "getProfileUrl":
      return await handleGetProfileUrl();

    default:
      return { error: "unknown_action" };
  }
}

async function handleGetProfileUrl() {
  const base = await getCurrentAppBaseUrl();
  return { url: `${base}/profile?autofill=1` };
}

async function getCurrentAppBaseUrl() {
  // Matches manifest externally_connectable; keep a single place to change later.
  const cfg = await chrome.storage.local.get("jpConfig");
  const mode = cfg.jpConfig?.apiMode || "prod";
  return mode === "dev"
    ? "http://localhost:5173"
    : "https://jobpilot-wheat.vercel.app";
}

// ── Manual Autofill (popup) ───────────────────────────────────────────────────

async function handleAutofillCurrentTab() {
  const token = await getAuthToken();
  if (!token) return { error: "not_authenticated" };

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs?.[0];
  const tabId = tab?.id;
  const url = tab?.url || "";
  if (!tabId || !url || url.startsWith("chrome://")) {
    return { error: "no_active_tab" };
  }

  // Ensure we have resume data ready (same source as queue runner)
  if (!state.resumeData) {
    await loadResumeData();
  }
  if (!state.resumeData) {
    return { error: "no_resume_data" };
  }

  const isWorkday = /(\.|^)workday\.com|(\.|^)myworkdayjobs\.com/i.test(url);

  // Inject shared fillers. For Workday we inject into all frames since forms
  // often live inside iframes.
  const injectOk = await injectScripts(
    tabId,
    [
      "utils/api.js",
      "utils/dom.js",
      "utils/resolveLabel.js",
      "utils/formFiller.js",
      "utils/panelKernel.js",
      "utils/resumeFile.js",
      ...(isWorkday ? ["content-scripts/workday.js"] : []),
    ],
    { allFrames: isWorkday }
  );
  if (!injectOk) return { error: "inject_failed" };

  let resumeAttachment = null;
  try {
    resumeAttachment = await getResumeFileAsBase64();
  } catch (e) {
    logger.warn(`[JobPilot][Autofill] Resume not attached: ${e.message}`);
  }

  // Workday: use the dedicated content script in one-shot mode so it can:
  // - click Add Experience/Education
  // - fill listbox dropdown questions
  // - fill AI long answers safely
  if (isWorkday) {
    try {
      const resp = await sendMessageWithTimeout(
        tabId,
        {
          action: "applyToJob",
          resumeData: state.resumeData,
          resumeAttachment,
          jobContext: null,
          mode: "oneShot",
        },
        45000
      );
      if (resp?.error) return { error: resp.error };
      return { ok: true, filled: resp?.filled ?? 0, mode: "workday_oneShot" };
    } catch (e) {
      return { error: e?.message || "workday_autofill_failed" };
    }
  }

  // Execute a one-shot fill inside the tab. No navigation / submit clicks.
  const exec = await chrome.scripting.executeScript({
    target: { tabId, allFrames: isWorkday },
    args: [state.resumeData, resumeAttachment],
    func: (resumeData, resumeAttachmentArg) => {
      try {
        let filled = 0;

        // Try resume upload if we have a PDF and helper exists.
        try {
          if (
            resumeAttachmentArg?.base64 &&
            globalThis.JobPilotResumeFile &&
            typeof globalThis.JobPilotResumeFile.findResumeFileInput === "function" &&
            typeof globalThis.JobPilotResumeFile.setFileInputFromBase64 === "function"
          ) {
            const input = globalThis.JobPilotResumeFile.findResumeFileInput(
              document.documentElement,
              typeof globalThis.getFieldLabel === "function"
                ? globalThis.getFieldLabel
                : null
            );
            if (input && (!input.files || input.files.length === 0)) {
              const ok = globalThis.JobPilotResumeFile.setFileInputFromBase64(
                input,
                resumeAttachmentArg.base64,
                resumeAttachmentArg.fileName || "resume.pdf"
              );
              if (ok) {
                filled++;
              }
            }
          }
        } catch {
          /* ignore */
        }

        if (typeof globalThis.fillAllFields === "function") {
          filled += globalThis.fillAllFields(document.documentElement, resumeData);
        }

        if (typeof globalThis.nudgeFormAfterFill === "function") {
          try {
            globalThis.nudgeFormAfterFill(document.documentElement, globalThis.PanelKernel);
          } catch {
            /* ignore */
          }
        }

        return {
          ok: true,
          filled,
          frame: window === window.top ? "top" : "iframe",
          href: location.href,
        };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    },
  });

  const results = (exec || []).map((r) => r.result).filter(Boolean);
  const firstError = results.find((r) => r.ok === false);
  if (firstError) return { error: firstError.error || "autofill_failed" };

  const totalFilled = results.reduce(
    (sum, r) => sum + (typeof r.filled === "number" ? r.filled : 0),
    0
  );
  return { ok: true, filled: totalFilled };
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

      if (_naukriDebugStopQueueAfterJob) {
        logger.info("[JobPilot][Debug] Auto-flow paused for manual debugging");
        logger.info(
          "[JobPilot][Debug] Queue batch stopped (set jobpilot_naukri_debug to 0 or reload extension flow to continue auto-queue)"
        );
        broadcast(
          `Debug mode: tab kept open — ${total - i - 1} queued job(s) in this batch were not started`,
          i + 1,
          total
        );
        break;
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
  _naukriDebugStopQueueAfterJob = false;

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
    const isWorkday = /(\.|^)workday\.com|(\.|^)myworkdayjobs\.com/i.test(jobUrl);
    const isGreenhouse = /(job-boards\.greenhouse\.io|boards\.greenhouse\.io)/i.test(jobUrl);
    const isLever = /jobs\.lever\.co/i.test(jobUrl);

    if (isNaukri) {
      log.step("inject", "naukri");
      let injectOk = await waitForNaukriContentScriptsReady(tab.id, 15000);
      if (!injectOk) {
        logger.warn(
          "[JobPilot][Naukri] Manifest scripts not ready in time — programmatic inject fallback"
        );
        injectOk = await injectNaukriScriptStack(tab.id);
      }
      if (!injectOk) {
        log.step("inject", "failed_probe");
        await safeStatusUpdate(
          application._id,
          "failed",
          "Extension could not load Naukri scripts (PanelKernel / naukri probe failed)"
        );
        return {
          success: false,
          error: "naukri_inject_probe_failed",
          skip: false,
        };
      }
    } else if (isLinkedIn) {
      log.step("inject", "linkedin");
      await injectScripts(tab.id, [
        "utils/api.js",
        "utils/dom.js",
        "utils/formFiller.js",
        "content-scripts/linkedin.js",
      ]);
    } else if (isWorkday) {
      log.step("inject", "workday");
      await injectScripts(
        tab.id,
        [
          "utils/api.js",
          "utils/dom.js",
          "utils/resolveLabel.js",
          "utils/formFiller.js",
          "utils/panelKernel.js",
          "utils/resumeFile.js",
          "content-scripts/workday.js",
        ],
        { allFrames: true }
      );
    } else if (isGreenhouse) {
      log.step("inject", "greenhouse");
      await injectScripts(tab.id, [
        "utils/api.js",
        "utils/dom.js",
        "utils/resolveLabel.js",
        "utils/formFiller.js",
        "utils/panelKernel.js",
        "utils/resumeFile.js",
        "content-scripts/greenhouse.js",
      ]);
    } else if (isLever) {
      log.step("inject", "lever");
      await injectScripts(tab.id, [
        "utils/api.js",
        "utils/dom.js",
        "utils/resolveLabel.js",
        "utils/formFiller.js",
        "utils/panelKernel.js",
        "utils/resumeFile.js",
        "content-scripts/lever.js",
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

    let resumeAttachment = null;
    if (isNaukri || isWorkday || isGreenhouse || isLever) {
      try {
        resumeAttachment = await getResumeFileAsBase64();
        if (resumeAttachment) {
          log.step(
            "resume",
            "attachment",
            `loaded (${Math.round(resumeAttachment.base64.length / 1024)} KB b64)`
          );
        }
      } catch (e) {
        log.warn(`Resume PDF not attached: ${e.message}`);
      }
    }

    // ── Phase 1: Content script apply attempt (with retry) ──
    let csResult;
    try {
      csResult = await sendMessageWithRetry(
        tab.id,
        {
          action: "applyToJob",
          resumeData: state.resumeData,
          resumeAttachment,
          jobContext: {
            jobTitle: application?.jobId?.title || null,
            companyName: application?.jobId?.company || null,
            jobDescription: application?.jobId?.description || null,
          },
        },
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
      if (!tab?.id) return;

      const keepOpenForDebug =
        /naukri\.com/i.test(jobUrl) && (await readNaukriTabDebugPause(tab.id));

      if (keepOpenForDebug) {
        _naukriDebugStopQueueAfterJob = true;
        logger.info("[JobPilot][Debug] Auto-flow paused for manual debugging");
        logger.info(
          "[JobPilot][Debug] Naukri tab left open; remaining jobs in this batch were not started"
        );
        try {
          await chrome.tabs.update(tab.id, { active: true });
        } catch (e) {
          logger.warn(`Could not focus debug tab: ${e.message}`);
        }
      } else {
        await chrome.tabs.remove(tab.id);
      }
    } catch (e) {
      logger.warn(`Tab cleanup: ${e.message}`);
    }
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
 * Injected on Naukri only. Stricter than probePageForSuccess — ignores JD body
 * noise that caused false "applied" on job-listings pages.
 */
function probeNaukriStrictSuccess() {
  function buttonShowsApplied(btn) {
    if (!btn || !btn.textContent) return false;
    const t = btn.textContent.toLowerCase().replace(/\s+/g, " ").trim();
    if (!t.includes("applied")) return false;
    if (t.length > 120) return false;
    return (
      t === "applied" ||
      /^applied\s*$/i.test(t) ||
      t.includes("already applied") ||
      t.includes("you have already applied") ||
      t.includes("you've already applied") ||
      t.includes("applied successfully")
    );
  }

  const href = location.href.toLowerCase();
  if (href.includes("/myapply/saveapply")) return { reason: "url_saveapply" };
  if (href.includes("/thankjob") || href.includes("applystatus=success"))
    return { reason: "url_thankjob" };
  if (href.includes("/apply/confirmation")) return { reason: "url_confirmation" };

  try {
    const params = new URLSearchParams(location.search);
    const raw = params.get("multiApplyResp");
    if (raw) {
      const decoded = decodeURIComponent(raw);
      try {
        const parsed = JSON.parse(decoded);
        const status = parsed?.status ?? parsed?.statusCode;
        if (Number(status) === 200) return { reason: "multiApplyResp_200" };
      } catch {
        /* no loose string match */
      }
    }
  } catch {
    /* ignore */
  }

  if (
    document.querySelector(
      ".styles_already-applied__MMRPM,.already-applied," +
        "[class*='alreadyApplied'],[class*='already_applied']"
    )
  ) {
    return { reason: "dom_already_applied" };
  }

  const btnSelectors = [
    "#apply-button",
    ".apply-button",
    "[class*='apply-btn']",
    "[class*='applyButton']",
  ];
  for (const sel of btnSelectors) {
    try {
      const btn = document.querySelector(sel);
      if (btn && buttonShowsApplied(btn)) return { reason: "button_text_applied" };
    } catch {
      /* ignore */
    }
  }

  const overlayPhrases = [
    "successfully applied",
    "application sent",
    "application submitted",
    "you have already applied",
    "applied successfully",
    "your application was sent",
    "your application has been submitted",
    "application was submitted",
  ];
  try {
    const roots = document.querySelectorAll(
      "[role='dialog'],#apply_dialog," +
        "[class*='chatbot'],[class*='ChatBot'],[class*='apply-sidebar']," +
        "[class*='applyModule'],[class*='quickApply'],[class*='apply-drawer']"
    );
    for (const root of roots) {
      const chunk = (root.innerText || "").toLowerCase();
      if (chunk.length > 8000) continue;
      for (let i = 0; i < overlayPhrases.length; i++) {
        if (chunk.includes(overlayPhrases[i]))
          return { reason: "scoped_text:" + overlayPhrases[i] };
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

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

    if (platform === "naukri") {
      const [probe] = await chrome.scripting.executeScript({
        target: { tabId },
        func: probeNaukriStrictSuccess,
      });
      if (probe?.result) {
        log.info(`Verify: Naukri strict probe — ${probe.result.reason}`);
        return { success: true, reason: `naukri:${probe.result.reason}` };
      }
      log.info("Verify: no Naukri strict success signal");
      return { success: false, reason: "no_signal" };
    }

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
    log.warn(`Verify: error (${err.message})`);
    return { success: false, reason: `verify_error:${err.message}` };
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
        const probeFunc =
          platform === "naukri" ? probeNaukriStrictSuccess : probePageForSuccess;
        const [probe] = await chrome.scripting.executeScript({
          target: { tabId },
          func: probeFunc,
        });

        if (probe?.result) {
          const msg =
            platform === "naukri"
              ? `naukri:${probe.result.reason || "strict"}`
              : "page_content_success";
          return { success: true, message: msg };
        }
      }
    } catch (tabErr) {
      log.warn(`Recovery: attempt error (${tabErr.message})`);
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

async function readNaukriTabDebugPause(tabId) {
  try {
    const frames = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          return localStorage.getItem("jobpilot_naukri_debug") === "1";
        } catch {
          return false;
        }
      },
    });
    const first = frames && frames[0];
    return first && first.result === true;
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<boolean>} true if executeScript succeeded
 */
async function injectScripts(tabId, files) {
  const allFrames = arguments.length >= 3 ? !!arguments[2]?.allFrames : false;
  if (!files?.length) return true;
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames },
      files,
    });
    return true;
  } catch (e) {
    logger.warn(`Inject failed (${files.join(", ")}): ${e.message}`);
    return false;
  }
}

/** Probes the extension isolated world in the tab (manifest + programmatic share this world). */
async function probeNaukriInjectState(tabId) {
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        panelKernel: typeof globalThis.PanelKernel !== "undefined",
        naukriInit: !!globalThis.__JOBPILOT_NAUKRI_INIT__,
      }),
    });
    return res?.[0]?.result || { panelKernel: false, naukriInit: false };
  } catch {
    return { panelKernel: false, naukriInit: false };
  }
}

/**
 * Waits for manifest `content_scripts` on Naukri (dom → … → panelKernel → naukri.js).
 * Avoids racing a second programmatic inject before `document_idle` has finished.
 */
async function waitForNaukriContentScriptsReady(tabId, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const p = await probeNaukriInjectState(tabId);
    if (p.panelKernel && p.naukriInit) {
      logger.info(
        "[JobPilot][Naukri] Content scripts ready (manifest): PanelKernel + naukri listener"
      );
      return true;
    }
    await delay(300);
  }
  return false;
}

/**
 * Injects Naukri automation stack and verifies PanelKernel (sidebar / deep DOM helpers).
 * Retries full stack once, then repairs with dom+panelKernel if needed.
 */
async function injectNaukriScriptStack(tabId) {
  const files = [
    "utils/dom.js",
    "utils/resolveLabel.js",
    "utils/formFiller.js",
    "utils/panelKernel.js",
    "utils/resumeFile.js",
    "content-scripts/naukri.js",
  ];

  let ok = await injectScripts(tabId, files);
  let probe = await probeNaukriInjectState(tabId);

  if (!ok || !probe.naukriInit) {
    logger.warn(
      "[JobPilot][Naukri] First inject incomplete — retrying full script stack once"
    );
    ok = await injectScripts(tabId, files);
    probe = await probeNaukriInjectState(tabId);
  }

  if (probe.naukriInit && !probe.panelKernel) {
    logger.warn(
      "[JobPilot][Naukri] PanelKernel missing while naukri loaded — repair inject (dom + panelKernel)"
    );
    await injectScripts(tabId, ["utils/dom.js", "utils/panelKernel.js"]);
    probe = await probeNaukriInjectState(tabId);
  }

  if (!probe.panelKernel || !probe.naukriInit) {
    logger.error(
      "[JobPilot][Naukri] Injection probe failed — panelKernel: " +
        !!probe.panelKernel +
        ", naukriInit: " +
        !!probe.naukriInit +
        ". Open chrome://extensions → JobPilot → Service worker → Inspect, and check for errors after inject."
    );
    return false;
  }

  return true;
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
