if (!globalThis.__JOBPILOT_GH_INIT__) {
  globalThis.__JOBPILOT_GH_INIT__ = true;

  const TAG = "[JobPilot][Greenhouse]";
  const log = {
    info: (...a) => console.log(TAG, ...a),
    warn: (...a) => console.warn(TAG, ...a),
    error: (...a) => console.error(TAG, ...a),
  };

  let _resumeData = null;
  let _resumeAttachment = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action !== "applyToJob") return;

    _resumeData = message.resumeData || null;
    _resumeAttachment = message.resumeAttachment || null;
    globalThis.__JOBPILOT_AUTOFILL_DEBUG__ = !!message.debugAutofill;

    runOneShotGreenhouse()
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));

    return true;
  });

  async function runOneShotGreenhouse() {
    await delay(600);

    // Greenhouse usually has a single application form in light DOM
    const root =
      document.querySelector("#application_form") ||
      document.querySelector("#application-form") ||
      document.querySelector("form") ||
      document.documentElement;

    let filled = 0;

    // Resume upload
    try {
      if (_resumeAttachment?.base64 && globalThis.JobPilotResumeFile) {
        const input =
          root.querySelector('input[type="file"]#resume') ||
          root.querySelector('input[type="file"][name*="resume" i]') ||
          globalThis.JobPilotResumeFile.findResumeFileInput(
            root,
            typeof globalThis.getFieldLabel === "function" ? globalThis.getFieldLabel : null
          );
        if (input && (!input.files || input.files.length === 0)) {
          const ok = globalThis.JobPilotResumeFile.setFileInputFromBase64(
            input,
            _resumeAttachment.base64,
            _resumeAttachment.fileName || "resume.pdf"
          );
          if (ok) filled++;
        }
      }
    } catch (e) {
      log.warn("Resume upload failed:", e?.message || String(e));
    }

    // Generic fill (Greenhouse labels are usually good)
    try {
      if (typeof fillAllFields === "function") {
        filled += fillAllFields(root, _resumeData);
      }
      if (typeof nudgeFormAfterFill === "function") {
        nudgeFormAfterFill(root, globalThis.PanelKernel);
      }
    } catch (e) {
      log.warn("fillAllFields failed:", e?.message || String(e));
    }

    log.info("Filled fields:", filled);
    if (globalThis.__JOBPILOT_AUTOFILL_DEBUG__) {
      console.log("[JobPilot][Autofill][Greenhouse] run complete", { filled, href: location.href });
    }
    return { success: true, message: "filled", filled };
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

