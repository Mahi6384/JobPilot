if (!globalThis.__JOBPILOT_LEVER_INIT__) {
  globalThis.__JOBPILOT_LEVER_INIT__ = true;

  const TAG = "[JobPilot][Lever]";
  const log = {
    info: (...a) => console.log(TAG, ...a),
    warn: (...a) => console.warn(TAG, ...a),
    error: (...a) => console.error(TAG, ...a),
  };

  let _resumeData = null;
  let _resumeAttachment = null;
  let _jobContext = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action !== "applyToJob") return;

    _resumeData = message.resumeData || null;
    _resumeAttachment = message.resumeAttachment || null;
    _jobContext = message.jobContext || null;

    runOneShotLever()
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));

    return true;
  });

  async function runOneShotLever() {
    await delay(600);

    const root =
      document.querySelector("#application-form") ||
      document.querySelector("#application_form") ||
      document.querySelector("form") ||
      document.documentElement;

    let filled = 0;

    // Resume upload
    try {
      if (_resumeAttachment?.base64 && globalThis.JobPilotResumeFile) {
        const input =
          root.querySelector('input[type="file"]#resume-upload-input') ||
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

    // Lever has common field names for socials; fill these explicitly using setNativeValue
    try {
      const fillNamed = (name, value) => {
        if (!value) return 0;
        const el = root.querySelector(`input[name="${cssEscape(name)}"]`);
        if (!el) return 0;
        if (String(el.value || "").trim()) return 0;
        if (typeof setNativeValue === "function") setNativeValue(el, value);
        else {
          el.value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return 1;
      };

      filled += fillNamed("urls[LinkedIn]", _resumeData?.linkedinUrl || "");
      filled += fillNamed("urls[GitHub]", _resumeData?.socials?.githubUrl || "");
      filled += fillNamed("urls[Portfolio]", _resumeData?.socials?.portfolioUrl || "");
    } catch (e) {
      log.warn("Named socials fill failed:", e?.message || String(e));
    }

    // Generic fill (labels/aria-label are usable on Lever)
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

    // AI fallback for unknown long-answer questions (never overwrites).
    try {
      if (typeof fillLongAnswerWithAI === "function") {
        const candidates = Array.from(root.querySelectorAll("textarea"));
        for (const el of candidates) {
          if (!el || !el.isConnected) continue;
          if (String(el.value || "").trim()) continue;
          const label =
            (typeof globalThis.getFieldLabel === "function"
              ? globalThis.getFieldLabel(el)
              : el.getAttribute("aria-label") ||
                el.getAttribute("placeholder") ||
                el.getAttribute("name") ||
                "") || "";

          const did = await fillLongAnswerWithAI(el, label, _resumeData, _jobContext, {
            onSkip: (d) =>
              log.info("AI skip", d?.reason || "", (d?.label || "").slice(0, 80)),
          });
          if (did) {
            filled++;
            await delay(150);
          }
        }
      }
    } catch (e) {
      log.warn("AI long-answer fill failed:", e?.message || String(e));
    }

    log.info("Filled fields:", filled);
    return { success: true, message: "filled", filled };
  }

  function cssEscape(s) {
    try {
      return CSS && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/"/g, '\\"');
    } catch {
      return String(s).replace(/"/g, '\\"');
    }
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

