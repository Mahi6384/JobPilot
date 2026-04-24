if (!globalThis.__JOBPILOT_GENERIC_FORMS_INIT__) {
  globalThis.__JOBPILOT_GENERIC_FORMS_INIT__ = true;

  const TAG = "[JobPilot][GenericForms]";
  const log = {
    info: (...a) => console.log(TAG, ...a),
    warn: (...a) => console.warn(TAG, ...a),
    error: (...a) => console.error(TAG, ...a),
  };

  log.info("Content script loaded", { url: location.href, readyState: document.readyState });

  async function getResumeData() {
    try {
      const result = await chrome.storage.local.get("resumeData");
      return result.resumeData || null;
    } catch (e) {
      log.warn("Failed to read resumeData from storage", e?.message || e);
      return null;
    }
  }

  function tryFill(resumeData) {
    if (!resumeData) return 0;
    if (typeof globalThis.fillAllFields !== "function") return 0;
    try {
      return globalThis.fillAllFields(document.documentElement, resumeData) || 0;
    } catch (e) {
      log.warn("fillAllFields error", e?.message || e);
      return 0;
    }
  }

  async function runAutoFillWindow() {
    const start = Date.now();
    const maxMs = 90_000;
    const intervalMs = 2500;

    let resumeData = await getResumeData();
    if (!resumeData) {
      log.warn(
        "No resumeData in extension storage yet. Complete onboarding / login in JobPilot first, then refresh this page."
      );
    }

    const timer = setInterval(async () => {
      if (Date.now() - start > maxMs) {
        clearInterval(timer);
        log.info("Auto-fill window ended");
        return;
      }

      if (!resumeData) resumeData = await getResumeData();
      const n = tryFill(resumeData);
      if (n > 0) {
        log.info("Filled fields", { count: n });
      }
    }, intervalMs);
  }

  // Start after idle (document_idle), plus a tiny delay for SPA renders.
  setTimeout(() => {
    runAutoFillWindow().catch((e) => log.error("runAutoFillWindow failed", e?.message || e));
  }, 800);
}

