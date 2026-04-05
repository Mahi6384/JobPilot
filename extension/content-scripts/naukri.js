if (!globalThis.__JOBPILOT_NAUKRI_INIT__) {
  globalThis.__JOBPILOT_NAUKRI_INIT__ = true;

  const _log = {
    info: (...a) => console.log("[JobPilot][Naukri]", ...a),
    warn: (...a) => console.warn("[JobPilot][Naukri]", ...a),
    error: (...a) => console.error("[JobPilot][Naukri]", ...a),
  };

  let _naukriResumeData = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "applyToJob") {
      _naukriResumeData = message.resumeData || null;
      _log.info("Received applyToJob message");
      _runWithTimeout(applyToNaukriJob, 80000)
        .then((result) => {
          _log.info("Apply flow resolved:", JSON.stringify(result));
          sendResponse(result);
        })
        .catch((err) => {
          _log.error("Apply flow rejected:", err.message);
          const probe = probeNaukriApplied();
          if (probe.ok) {
            _log.info(
              "Error caught BUT success detected on page — reporting success"
            );
            sendResponse({ success: true, message: probe.reason });
          } else {
            sendResponse({ success: false, error: err.message });
          }
        });
      return true;
    }
  });

  function _runWithTimeout(fn, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        _log.warn("Timeout reached — running final success probe");
        const probe = probeNaukriApplied();
        if (probe.ok) {
          resolve({ success: true, message: `timeout_but_${probe.reason}` });
        } else {
          reject(new Error("Apply flow timed out"));
        }
      }, ms);
      fn()
        .then((r) => {
          clearTimeout(timer);
          resolve(r);
        })
        .catch((e) => {
          clearTimeout(timer);
          reject(e);
        });
    });
  }

  // ── Main Flow ──────────────────────────────────────────────────────────────

  async function applyToNaukriJob() {
    _log.info("Starting Naukri apply flow");

    const earlyCheck = probeNaukriApplied();
    if (earlyCheck.ok) {
      _log.info(`Already applied: ${earlyCheck.reason}`);
      return { success: true, message: earlyCheck.reason };
    }

    if (
      document.querySelector(
        ".styles_already-applied__MMRPM, .already-applied, [class*='alreadyApplied']"
      )
    ) {
      _log.info("Already applied (DOM indicator)");
      return { success: true, message: "already_applied_dom" };
    }

    const applyBtn = findNaukriApplyButton();
    if (!applyBtn) {
      const fallback = probeNaukriApplied();
      if (fallback.ok) return { success: true, message: fallback.reason };
      _log.warn("No Apply button found");
      return { success: false, error: "No Apply button found", skip: true };
    }

    _log.info("Clicking Apply button");
    safeClick(applyBtn);

    const afterClick = await pollNaukriApplied(10000);
    if (afterClick.ok) {
      _log.info(`Success after click: ${afterClick.reason}`);
      return { success: true, message: afterClick.reason };
    }

    const sidebar = document.querySelector(
      "[class*='chatbot'], [class*='apply-sidebar'], [class*='applyModule'], " +
        "#apply_dialog, [class*='chatbot_Container'], [class*='ChatBot']"
    );

    if (sidebar) {
      _log.info("Sidebar/chatbot detected — handling questionnaire");
      return await handleNaukriQuestionnaire(sidebar);
    }

    _log.info("No immediate success — trying generic questionnaire handler");
    return await handleNaukriQuestionnaire(document);
  }

  // ── Apply Button Finder ────────────────────────────────────────────────────

  function findNaukriApplyButton() {
    const byId = document.getElementById("apply-button");
    if (byId && byId.offsetParent !== null) return byId;

    const selectors = [
      ".apply-button",
      "[class*='apply-btn']",
      "[class*='applyButton']",
      "button[id*='apply']",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }

    const jobArea =
      document.querySelector(
        "[class*='jd-header'], [class*='job-header'], .naukri-jd, #job_header, main"
      ) || document;

    const btn = findClickableByText("Apply", jobArea);
    if (btn) return btn;

    return findButtonByText("Apply");
  }

  // ── Questionnaire Handler ──────────────────────────────────────────────────

  async function handleNaukriQuestionnaire(container) {
    const MAX_ATTEMPTS = 25;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await delay(1000);

      const probe = probeNaukriApplied();
      if (probe.ok) {
        _log.info(
          `Success during questionnaire (${i + 1}): ${probe.reason}`
        );
        return { success: true, message: probe.reason };
      }

      const fieldsFilled = fillAllFields(container, _naukriResumeData);
      if (fieldsFilled > 0) {
        _log.info(`Filled ${fieldsFilled} fields (attempt ${i + 1})`);
      }

      const skipBtn =
        findClickableByText("Skip this question") ||
        findClickableByText("Skip") ||
        document.querySelector("[class*='skip']");

      if (skipBtn && skipBtn.offsetParent !== null) {
        _log.info(`Skipping question (attempt ${i + 1})`);
        safeClick(skipBtn);
        await delay(800);
        continue;
      }

      const actionBtn =
        findClickableByText("Submit") ||
        findClickableByText("Save") ||
        findClickableByText("Apply") ||
        findClickableByText("Next") ||
        document.querySelector("[class*='save-job-button']");

      if (actionBtn && actionBtn.offsetParent !== null) {
        _log.info(
          `Clicking: "${actionBtn.textContent.trim()}" (attempt ${i + 1})`
        );
        safeClick(actionBtn);
        await delay(2000);

        const afterAction = await pollNaukriApplied(6000);
        if (afterAction.ok) {
          _log.info(`Success after action: ${afterAction.reason}`);
          return { success: true, message: afterAction.reason };
        }
        continue;
      }

      const unfilledInput = container.querySelector(
        "input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox'])"
      );
      if (unfilledInput && !unfilledInput.value) {
        fillTextField(unfilledInput, _naukriResumeData);
        await delay(500);
        const next =
          findClickableByText("Save") ||
          findClickableByText("Next") ||
          findClickableByText("Submit");
        if (next) safeClick(next);
        await delay(1000);
        continue;
      }

      const unfilledSelect = container.querySelector("select");
      if (unfilledSelect && !unfilledSelect.value) {
        fillDropdown(unfilledSelect, _naukriResumeData);
        await delay(500);
        const next =
          findClickableByText("Save") || findClickableByText("Next");
        if (next) safeClick(next);
        await delay(1000);
        continue;
      }

      const uncheckedRadio = container.querySelector(
        "input[type='radio']:not(:checked)"
      );
      if (uncheckedRadio) {
        const name = uncheckedRadio.getAttribute("name");
        if (name) {
          fillRadioGroup(
            container.querySelectorAll(
              `input[type='radio'][name='${name}']`
            )
          );
          await delay(500);
          const next =
            findClickableByText("Save") || findClickableByText("Next");
          if (next) safeClick(next);
          await delay(1000);
          continue;
        }
      }
    }

    return await finalNaukriCheck("Could not complete questionnaire");
  }

  // ── Success Detection ──────────────────────────────────────────────────────

  function probeNaukriApplied() {
    const href = location.href.toLowerCase();

    if (href.includes("/myapply/saveapply")) {
      return { ok: true, reason: "url_saveApply" };
    }
    if (href.includes("/thankjob") || href.includes("applystatus=success")) {
      return { ok: true, reason: "url_success_page" };
    }
    if (href.includes("/apply/confirmation")) {
      return { ok: true, reason: "url_confirmation" };
    }

    try {
      const params = new URLSearchParams(location.search);
      const raw = params.get("multiApplyResp");
      if (raw) {
        const decoded = decodeURIComponent(raw);
        try {
          const parsed = JSON.parse(decoded);
          const status = parsed?.status ?? parsed?.statusCode;
          if (Number(status) === 200)
            return { ok: true, reason: "multiApplyResp_200" };
        } catch {}
        if (decoded.includes("200") || decoded.includes("success")) {
          return { ok: true, reason: "multiApplyResp_text" };
        }
      }
    } catch {}

    const btnSelectors = [
      "#apply-button",
      ".apply-button",
      "[class*='apply-btn']",
      "[class*='applyButton']",
    ];
    for (const sel of btnSelectors) {
      const btn = document.querySelector(sel);
      if (btn && btn.textContent.toLowerCase().includes("applied")) {
        return { ok: true, reason: "button_text_applied" };
      }
    }

    if (
      document.querySelector(
        ".styles_already-applied__MMRPM, .already-applied, " +
          "[class*='alreadyApplied'], [class*='already_applied']"
      )
    ) {
      return { ok: true, reason: "dom_already_applied" };
    }

    const successPhrases = [
      "successfully applied",
      "application sent",
      "already applied",
      "application submitted",
      "you have already applied",
      "applied successfully",
      "congratulations",
      "application received",
    ];
    const bodyText = (document.body?.innerText || "").toLowerCase();
    for (const phrase of successPhrases) {
      if (bodyText.includes(phrase))
        return { ok: true, reason: `text:"${phrase}"` };
    }

    const candidates = document.querySelectorAll(
      "[class*='applied'], [class*='success'], [class*='congrat']"
    );
    for (const el of candidates) {
      const t = (el.innerText || "").toLowerCase();
      if (
        t.includes("applied") ||
        t.includes("application sent") ||
        t.includes("congratulations")
      ) {
        return { ok: true, reason: "element_text_match" };
      }
    }

    return { ok: false, reason: "no_success_signal" };
  }

  async function pollNaukriApplied(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const probe = probeNaukriApplied();
      if (probe.ok) return probe;
      await delay(500);
    }
    return probeNaukriApplied();
  }

  async function finalNaukriCheck(errorMessage) {
    const lastCheck = await pollNaukriApplied(5000);
    if (lastCheck.ok) {
      _log.info(`Failure overridden by final probe: ${lastCheck.reason}`);
      return { success: true, message: lastCheck.reason };
    }
    _log.warn(`Failure confirmed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}
