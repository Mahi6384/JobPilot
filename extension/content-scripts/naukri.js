if (!globalThis.__JOBPILOT_NAUKRI_INIT__) {
  globalThis.__JOBPILOT_NAUKRI_INIT__ = true;

  console.log(
    "[JobPilot][Naukri] naukri.js initializing — typeof globalThis.PanelKernel:",
    typeof globalThis.PanelKernel,
    "(in DevTools, pick execution context “JobPilot” / this extension — not “top” Page — to see extension globals)"
  );

  const _log = {
    info: (...a) => console.log("[JobPilot][Naukri]", ...a),
    warn: (...a) => console.warn("[JobPilot][Naukri]", ...a),
    error: (...a) => console.error("[JobPilot][Naukri]", ...a),
  };

  function _dbg() {
    return globalThis.JobPilotNaukriDebug || null;
  }

  /** Matches background check: localStorage jobpilot_naukri_debug === "1" */
  function _naukriPageDebugLsOn() {
    try {
      return localStorage.getItem("jobpilot_naukri_debug") === "1";
    } catch {
      return false;
    }
  }

  /** Pause after apply UI is ready so the tab is not advanced until run() / Start Autofill. */
  async function _maybePauseAtSidebarForDebug() {
    if (!_naukriPageDebugLsOn()) return;
    const dbg = _dbg();
    if (dbg && typeof dbg.waitForSidebarGate === "function") {
      await dbg.waitForSidebarGate();
    }
  }

  function _formHooks() {
    const d = _dbg();
    return d && typeof d.getFormFillHooks === "function" ? d.getFormFillHooks() : null;
  }

  /** Logs + optional overlay line for primary clicks (Apply / Next / Skip / etc.). */
  function naukriSafeClick(el, reason) {
    const d = _dbg();
    if (d && d.isEnabled()) {
      try {
        const t =
          (el &&
            (el.textContent || "").trim().slice(0, 100)) ||
          el?.getAttribute?.("aria-label") ||
          el?.tagName ||
          "?";
        d.log("action", "click", { reason: reason || "unknown", label: t });
        d.setOverlayStatus("Action: " + t.slice(0, 60), undefined);
      } catch (e) {
        d.logError("naukriSafeClick", e);
      }
    }
    return safeClick(el);
  }

  let _naukriResumeData = null;
  /** PDF from JobPilot API (background fetch) for `<input type="file">`. */
  let _resumeAttachment = null;
  /** Last apply panel root (for debug Re-run Fill). */
  let _lastPanelRoot = null;
  let _lastSnapshot = null;
  /** Fingerprint of last bot question we acted on (Naukri chat turn driver). */
  let _naukriChatTurnState = { fp: "" };

  function _getLastBotQuestionText(panel, pak) {
    try {
      const botMsgSel = ".botMsg, [class*='botMsg'], [class*='BotMsg']";
      const all =
        pak && pak.deepQuerySelectorAll
          ? pak.deepQuerySelectorAll(panel, botMsgSel)
          : Array.from(panel.querySelectorAll(botMsgSel));
      let questionText = "";
      for (const el of all) {
        try {
          const visible =
            pak && pak.isVisible ? pak.isVisible(el) : el.offsetParent !== null;
          if (!visible) continue;
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (t.length >= 8) questionText = t;
        } catch {
          /* ignore */
        }
      }
      return questionText || "";
    } catch {
      return "";
    }
  }

  function _questionAsksForResumeUpload(qText) {
    const t = String(qText || "").toLowerCase();
    if (!t) return false;
    // Only attach resume when the question explicitly asks for it.
    return (
      /\b(resume|cv|curriculum vitae)\b/i.test(t) ||
      /\b(upload|attach|attachment)\b/i.test(t) ||
      /\b(pdf|docx?|document)\b/i.test(t)
    );
  }

  /** Structured stage logging for hint tuning (telemetry). */
  function _logStage(stage, detail) {
    _log.info(`[stage:${stage}]`, detail && typeof detail === "object" ? JSON.stringify(detail) : detail);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "applyToJob") {
      _naukriResumeData = message.resumeData || null;
      _resumeAttachment = message.resumeAttachment || null;
      globalThis.__JOBPILOT_AUTOFILL_DEBUG__ = !!message.debugAutofill;
      _log.info("Received applyToJob message", {
        hasResumePdf: !!(_resumeAttachment && _resumeAttachment.base64),
      });

      const d = _dbg();
      if (d && d.shouldDeferApply && d.shouldDeferApply()) {
        d.resetAbortFlag();
        d.deferApply(() => _runWithTimeout(applyToNaukriJob, 80000), sendResponse);
        return true;
      }

      if (d) d.resetAbortFlag();

      _runWithTimeout(applyToNaukriJob, 80000)
        .then((result) => {
          _log.info("Apply flow resolved:", JSON.stringify(result));
          sendResponse(result);
        })
        .catch((err) => {
          _log.error("Apply flow rejected:", err.message);
          if (d) d.logError("applyToJob", err);
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

  globalThis.__jobpilotRunNaukriApply__ = () => _runWithTimeout(applyToNaukriJob, 80000);

  globalThis.__jobpilotReRunNaukriFill__ = () => {
    const d = _dbg();
    const panel = _lastPanelRoot || document.documentElement;
    const hooks = _formHooks();
    try {
      if (d && d.isEnabled()) {
        d.log("action", "Re-run fill on panel", { hasPanel: !!_lastPanelRoot });
        d.setOverlayStatus("Re-run fill…", undefined);
      }
      const n = fillAllFields(panel, _naukriResumeData, hooks);
      const pak = globalThis.PanelKernel;
      naukriNudgeAfterFill(panel, pak);
      if (d && d.isEnabled()) {
        d.log("fill", "Re-run fill result", { filled: n });
        d.setOverlayStatus("Re-run fill done", String(n));
      }
      return n;
    } catch (e) {
      if (d) d.logError("__jobpilotReRunNaukriFill__", e);
      throw e;
    }
  };

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

  async function loadNaukriHints() {
    const url = chrome.runtime.getURL("config/naukri-hints.json");
    const r = await fetch(url);
    if (!r.ok) throw new Error(`naukri-hints: ${r.status}`);
    return r.json();
  }

  async function tryResumeUpload(panel, qText) {
    if (!_questionAsksForResumeUpload(qText)) return false;
    if (!_resumeAttachment || !_resumeAttachment.base64) return false;
    const JPR = globalThis.JobPilotResumeFile;
    if (!JPR || typeof JPR.setFileInputFromBase64 !== "function") {
      _log.warn("JobPilotResumeFile helper missing — cannot upload resume");
      return false;
    }
    const labelFn =
      typeof globalThis.getFieldLabel === "function"
        ? globalThis.getFieldLabel
        : null;
    const input = JPR.findResumeFileInput(panel, labelFn);
    if (!input) return false;
    if (input.files && input.files.length > 0) return false;

    const ok = JPR.setFileInputFromBase64(
      input,
      _resumeAttachment.base64,
      _resumeAttachment.fileName || "resume.pdf"
    );
    if (ok) {
      _log.info("Resume PDF attached to Naukri file input");
      await delay(700);
    }
    return ok;
  }

  function defaultNaukriHints() {
    return {
      version: 0,
      minScore: 4,
      shadowHosts: [],
      rootSelectors: [
        "[class*='chatbot_Drawer']",
        "[class*='chatbot_right']",
        "[class*='chatbot']",
        "[class*='sendMsgbtn_container']",
        "[class*='apply-sidebar']",
        "[class*='applyModule']",
        "#apply_dialog",
        "[class*='ChatBot']",
        "[class*='quickApply']",
        "[role='dialog']",
      ],
      dialogRoles: ["dialog", "complementary"],
      textAnchors: [
        "apply",
        "application",
        "resume",
        "question",
        "screening",
        "recruiter",
      ],
    };
  }

  // ── Main Flow ──────────────────────────────────────────────────────────────

  async function applyToNaukriJob() {
    const d = _dbg();
    if (d && d.isEnabled()) {
      d._ensureOverlay();
      d.log("detect", "applyToNaukriJob started");
      d.setOverlayStatus("Starting apply…", "—");
    }

    try {
    _log.info("Starting Naukri apply flow");

    let hints;
    try {
      hints = await loadNaukriHints();
    } catch (e) {
      _log.warn("naukri-hints load failed — defaults", e.message);
      hints = defaultNaukriHints();
    }

    const earlyCheck = probeNaukriApplied();
    if (earlyCheck.ok) {
      _log.info(`Already applied: ${earlyCheck.reason}`);
      if (d && d.isEnabled()) {
        d.log("detect", "Already applied", earlyCheck.reason);
        d.setOverlayStatus("Completed (already applied)", "—");
      }
      return { success: true, message: earlyCheck.reason };
    }

    if (
      document.querySelector(
        ".styles_already-applied__MMRPM, .already-applied, [class*='alreadyApplied']"
      )
    ) {
      _log.info("Already applied (DOM indicator)");
      if (d && d.isEnabled()) {
        d.setOverlayStatus("Completed (DOM already applied)", "—");
      }
      return { success: true, message: "already_applied_dom" };
    }

    const applyBtn = findNaukriApplyButton();
    if (!applyBtn) {
      const fallback = probeNaukriApplied();
      if (fallback.ok) {
        if (d && d.isEnabled()) d.setOverlayStatus("Completed", "—");
        return { success: true, message: fallback.reason };
      }
      _log.warn("No Apply button found");
      if (d && d.isEnabled()) {
        d.log("detect", "No Apply button found");
        d.setOverlayStatus("No Apply button", "—");
      }
      return { success: false, error: "No Apply button found", skip: true };
    }

    _log.info("Clicking Apply button");
    naukriSafeClick(applyBtn, "initial_apply");

    const afterClick = await pollNaukriApplied(10000);
    if (afterClick.ok) {
      _log.info(`Success after click: ${afterClick.reason}`);
      if (d && d.isEnabled()) {
        d.setOverlayStatus("Completed", "—");
        d.log("detect", "Success after initial Apply click", afterClick.reason);
      }
      return { success: true, message: afterClick.reason };
    }

    const pak = globalThis.PanelKernel;
    if (!pak) {
      _logStage("root", { ok: false, reason: "panel_kernel_missing" });
      _log.warn(
        "PanelKernel not loaded — document fallback. " +
          "Troubleshoot: (1) chrome://extensions → JobPilot → Service worker → Inspect — look for inject errors. " +
          "(2) On this tab console run: typeof PanelKernel (expect 'object'). " +
          "(3) Reload the job page and re-queue the application."
      );
      if (d && d.isEnabled()) {
        d.log("detect", "PanelKernel missing — questionnaire fallback on document");
        d.setOverlayStatus("No PanelKernel — doc fallback", "—");
      }
      return await stepNaukriApplyLoop(document.documentElement, hints, {
        documentFallback: true,
      });
    }

    if (d && d.isEnabled()) {
      d.log("detect", "waiting for apply sidebar / surface (MutationObserver)");
      d.setOverlayStatus("Waiting for sidebar…", "—");
    }

    const panelRoot = await pak.waitForApplySurface(hints, {
      timeoutMs: 15000,
      stabilityQuietMs: 280,
      stabilityMaxMs: 6000,
    });

    if (panelRoot) {
      _logStage("root", { ok: true, source: "pak" });
      _log.info("Apply surface resolved (PAK)");
      if (d && d.isEnabled()) {
        const nFields = d.countDetectableFields(panelRoot);
        d.log("detect", "Sidebar detected", {
          tag: panelRoot.tagName,
          className: panelRoot.className && String(panelRoot.className).slice(0, 120),
        });
        d.log("fields", "Fields found:", nFields);
        d.setOverlayStatus("Sidebar detected", String(nFields));
        d.setFieldsFoundLine(nFields);
      }
      await _maybePauseAtSidebarForDebug();
      return await stepNaukriApplyLoop(panelRoot, hints, {
        documentFallback: false,
      });
    }

    _logStage("root", { ok: false, reason: "timeout_no_surface" });
    _log.warn("PAK: no apply surface — last-resort questionnaire on document");
    if (d && d.isEnabled()) {
      d.log("detect", "Sidebar not found in time — document fallback");
      d.setOverlayStatus("No sidebar (timeout) — doc fallback", "—");
    }
    return await stepNaukriApplyLoop(document.documentElement, hints, {
      documentFallback: true,
    });
    } catch (e) {
      _log.error("applyToNaukriJob threw:", e && e.message ? e.message : e);
      if (d) {
        d.logError("applyToNaukriJob", e);
        d.setOverlayStatus("Error — see console", "—");
      }
      throw e;
    }
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
      "[data-testid*='apply']",
      "[data-testid*='Apply']",
      "[class*='applyCta']",
      "[class*='job-apply']",
      "[class*='jdApply']",
      "[class*='jd-apply']",
      "[class*='styles_apply']",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }

    const jobArea =
      document.querySelector(
        "[class*='jd-header'], [class*='job-header'], [class*='jobDetails'], [class*='jdLayout'], [class*='jdContainer'], .naukri-jd, #job_header, main, #root"
      ) || document;

    const btn = findClickableByText("Apply", jobArea);
    if (btn) return btn;

    return findButtonByText("Apply");
  }

  function _questionnaireButtons(panel, pak) {
    /* Naukri chatbot uses <div class="sendMsg" tabindex="0">Save</div>, not <button> */
    const sel =
      "button, [role='button'], input[type='submit'], input[type='button'], div.sendMsg";
    return pak && pak.deepQuerySelectorAll
      ? pak.deepQuerySelectorAll(panel, sel)
      : Array.from(panel.querySelectorAll(sel));
  }

  function _rectUsable(el) {
    try {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    } catch {
      return false;
    }
  }

  /** Prefer Save, then Next / Submit / Continue (exact-ish label, visible). */
  function findPrimaryQuestionnaireCta(panel, pak) {
    const scored = [];
    for (const el of _questionnaireButtons(panel, pak)) {
      if (!el || el.nodeType !== 1) continue;
      const raw = (
        el.textContent ||
        el.getAttribute("value") ||
        el.getAttribute("aria-label") ||
        ""
      ).trim();
      const t = raw.toLowerCase();
      if (!t) continue;
      if (!_rectUsable(el)) continue;
      let rank = 99;
      if (t === "save" || /^save\b/.test(t)) rank = 0;
      else if (t === "next") rank = 1;
      else if (t === "submit") rank = 2;
      else if (t === "continue" || /^continue\b/.test(t)) rank = 3;
      else continue;
      const r = el.getBoundingClientRect();
      scored.push({ el, rank, bottom: r.bottom });
    }
    scored.sort((a, b) => a.rank - b.rank || b.bottom - a.bottom);
    return scored[0]?.el || null;
  }

  function describeCtaClickable(el) {
    if (!el) return { ok: false, reason: "no-element" };
    // .disabled is only meaningful on real form elements; div.sendMsg always has .disabled===false
    if (el.disabled === true) return { ok: false, reason: "disabled" };
    if (el.getAttribute("aria-disabled") === "true")
      return { ok: false, reason: "aria-disabled" };
    const cls = (el.className && String(el.className).toLowerCase()) || "";
    if (/\bdisabled\b/.test(cls)) return { ok: false, reason: "class-disabled" };
    try {
      const style = window.getComputedStyle(el);
      // Naukri uses opacity ~0.3-0.4 on the Save div when it's not yet enabled.
      // The old threshold (0.12) was too lenient and allowed clicks on disabled buttons.
      if (Number(style.opacity) < 0.5) return { ok: false, reason: "low-opacity" };
      if (style.pointerEvents === "none")
        return { ok: false, reason: "pointer-events-none" };
    } catch {
      /* ignore */
    }
    if (!_rectUsable(el)) return { ok: false, reason: "no-box" };
    return { ok: true, reason: "ok" };
  }

  /* nudgeFormAfterFill lives in utils/dom.js (isConnected-guarded version). */

  /** Form text/select nudge + radio label re-clicks so React enables Save/Next. */
  function naukriNudgeAfterFill(panel, pak) {
    nudgeFormAfterFill(panel, pak);
    if (typeof nudgeRadioGroupsReact === "function") {
      try {
        nudgeRadioGroupsReact(panel);
      } catch (e) {
        _dbg()?.logError("nudgeRadioGroupsReact", e);
      }
    }
  }

  /**
   * @returns {boolean} true if a click was dispatched
   */
  function findNaukriSendMsgSave(panel, pak) {
    const els = pak && pak.deepQuerySelectorAll
      ? pak.deepQuerySelectorAll(panel, "div.sendMsg")
      : Array.from(panel.querySelectorAll("div.sendMsg"));
    for (const el of els) {
      const t = (el.textContent || "").trim().toLowerCase();
      if (t === "save" || /^save\b/.test(t)) return el;
    }
    return null;
  }

  /**
   * waitForCtaEnabled — polls until the primary CTA button transitions from
   * its "loading / not-yet-enabled" visual state to a clickable state.
   *
   * Naukri's Save div (div.sendMsg) is disabled via CSS opacity + pointer-events,
   * not via .disabled or aria-disabled. We must wait for these to clear before
   * dispatching the click, otherwise the React handler is not wired yet.
   *
   * @returns {Promise<Element|null>} the enabled button, or null on timeout
   */
  async function waitForCtaEnabled(panel, pak, timeoutMs) {
    const deadline = Date.now() + (timeoutMs != null ? timeoutMs : 4000);
    while (Date.now() < deadline) {
      const primary = findPrimaryQuestionnaireCta(panel, pak);
      const sendMsgSave = !primary && findNaukriSendMsgSave(panel, pak);
      const fallback =
        !primary &&
        !sendMsgSave &&
        (findClickableByText("Save", panel) ||
          findClickableByText("Next", panel) ||
          findClickableByText("Submit", panel));
      const btn = primary || sendMsgSave || fallback;
      if (btn && describeCtaClickable(btn).ok) return btn;
      await delay(200);
    }
    return null;
  }

  /**
   * tryClickQuestionnaireCta — async; waits up to 4 s for the CTA to become
   * enabled before clicking. Returns a Promise<boolean>.
   *
   * IMPORTANT: all call sites must await this function.
   */
  async function tryClickQuestionnaireCta(panel, pak, reasonTag) {
    const btn = await waitForCtaEnabled(panel, pak, 4000);
    if (!btn) {
      _log.info(
        `[JobPilot][Naukri][Action] CTA skip (${reasonTag}): no enabled Save/Next/Submit after wait`
      );
      return false;
    }
    const label = (btn.textContent || btn.value || "").trim().slice(0, 80);
    _log.info(`[JobPilot][Naukri][Action] CTA click (${reasonTag}): "${label}"`);
    _logStage("action", { step: reasonTag, label, kind: "questionnaire_cta" });
    naukriSafeClick(btn, reasonTag);
    return true;
  }

  // ── PAK step loop (replaces fixed delay questionnaire) ───────────────────

  function _snapshotPanelFieldValues(panel) {
    const m = new Map();
    const pak = globalThis.PanelKernel;
    if (!pak || !panel) return m;
    try {
      const els = pak.deepQuerySelectorAll(
        panel,
        "input:not([type='hidden']):not([type='file']), textarea, select"
      );
      for (const el of els) {
        if (pak.isVisible && !pak.isVisible(el)) continue;
        m.set(el, el.value);
      }
    } catch (e) {
      _dbg()?.logError("_snapshotPanelFieldValues", e);
    }
    return m;
  }

  function _logFieldResetsSinceSnapshot(snap, panelLabel) {
    const d = _dbg();
    if (!d || !d.isEnabled() || !snap || snap.size === 0) return;
    for (const [el, prev] of snap) {
      if (!prev || !String(prev).trim()) continue;
      try {
        if (el.isConnected && !(el.value && String(el.value).trim())) {
          d.log("retry", "field reset detected", {
            panel: panelLabel || "panel",
            name: el.getAttribute("name") || el.id || el.tagName,
          });
        }
      } catch (e) {
        d.logError("_logFieldResetsSinceSnapshot", e);
      }
    }
  }

  /**
   * fillNaukriChatbotComposer — direct fallback for Naukri campus chatbot.
   *
   * Why needed:
   *  - tryFillNaukriChatTurn uses isAfterInTree which fails when the composer
   *    is BEFORE the last .botMsg in DOM order (flex-column-reverse layout).
   *  - fillAllFields uses getFieldLabel → returns placeholder ("Type message
   *    here…") → no FIELD_MAP match → 0 fills.
   *
   * This directly: finds last .botMsg text → finds first empty visible input →
   * resolves value from question text → fills via keyboard simulation.
   */
  function fillNaukriChatbotComposer(panel, resumeData, pak) {
    if (!panel) return 0;

    // 1. Get question text from last visible .botMsg
    const botMsgSel = ".botMsg, [class*='botMsg'], [class*='BotMsg']";
    const allBotMsgs = pak && pak.deepQuerySelectorAll
      ? pak.deepQuerySelectorAll(panel, botMsgSel)
      : Array.from(panel.querySelectorAll(botMsgSel));

    let questionText = "";
    for (const el of allBotMsgs) {
      try {
        const visible = pak && pak.isVisible ? pak.isVisible(el) : el.offsetParent !== null;
        if (visible) {
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (t.length >= 8) questionText = t;
        }
      } catch { /* ignore */ }
    }
    if (!questionText) return 0;

    // 2. Find first empty visible text input OR contenteditable div in the panel
    const inputSel = [
      "input[type='text']",
      "input[type='number']",
      "input[type='tel']",
      "input:not([type])",
      "textarea",
      "[contenteditable='true']",
    ].join(", ");
    const allInputs = pak && pak.deepQuerySelectorAll
      ? pak.deepQuerySelectorAll(panel, inputSel)
      : Array.from(panel.querySelectorAll(inputSel));

    let targetInput = null;
    for (const el of allInputs) {
      if (!el.isConnected) continue;
      if (el.type === "hidden" || el.type === "file") continue;
      // Check already-filled: use textContent for contenteditable, value for inputs
      const currentVal = el.isContentEditable
        ? (el.textContent || "").trim()
        : (el.value || "").trim();
      if (currentVal) continue; // already filled
      const visible = pak && pak.isVisible ? pak.isVisible(el) : el.offsetParent !== null;
      if (!visible) continue;
      targetInput = el;
      break;
    }
    if (!targetInput) return 0;

    // 3. Resolve answer value from question text
    const label = questionText.slice(0, 900);
    let value = null;

    // Try FIELD_MAP matching first
    if (typeof matchFieldToKey === "function" && typeof resolveValue === "function") {
      const mapped = matchFieldToKey(label);
      if (mapped) value = resolveValue(mapped.key, resumeData, mapped.fallback);
      if (!value && typeof inferGenericTextAnswer === "function") {
        const inferred = inferGenericTextAnswer(label, resumeData);
        if (inferred && inferred.value) value = String(inferred.value);
      }
    }

    // Hard fallbacks for common Naukri chatbot questions
    if (!value) {
      const q = label.toLowerCase();
      if (/ctc|salary|lpa|lacs?|lakhs?|compensation|package/i.test(q)) {
        const raw = (resumeData && (resumeData.currentCtc || resumeData.expectedSalary)) || "";
        value = String(raw).replace(/[^\d.]/g, "") || "8";
      } else if (/notice|serving|joining|availability/i.test(q)) {
        value = (resumeData && resumeData.noticePeriod) || "30";
      } else if (/experience|years.*work|work.*years/i.test(q)) {
        value = String(resumeData?.experience?.years ?? "2");
      } else if (/relocat|travel|willing/i.test(q)) {
        value = "Yes";
      } else if (/name/i.test(q)) {
        value = (resumeData && resumeData.name) || "";
      } else if (/email/i.test(q)) {
        value = (resumeData && resumeData.email) || "";
      } else if (/phone|mobile/i.test(q)) {
        value = (resumeData && resumeData.phone) || "";
      }
    }

    if (!value) return 0;

    _log.info(`[Fill][ChatComposer] Q:"${label.slice(0, 80)}" → "${String(value).slice(0, 40)}"`);
    _fillByKeyboardSim(targetInput, String(value));
    return 1;
  }

  /**
   * _fillByKeyboardSim — fills an input by simulating real keyboard events.
   *
   * Handles two element types:
   *  - Regular <input>/<textarea>: char-by-char keydown+InputEvent+keyup
   *  - <div contenteditable="true">: document.execCommand('insertText') which
   *    is the ONLY reliable way to trigger React's synthetic onChange on a
   *    contenteditable element (Naukri campus chatbot uses this pattern).
   */
  function _fillByKeyboardSim(el, value) {
    if (!el || !el.isConnected) return;
    try { el.scrollIntoView({ block: "center", behavior: "instant" }); } catch { /* ignore */ }
    try { el.focus(); } catch { /* ignore */ }
    el.dispatchEvent(new Event("focus", { bubbles: true }));

    const str = String(value);

    // ── Contenteditable div (Naukri campus chatbot composer) ─────────────────
    if (el.isContentEditable) {
      // Clear existing content
      el.textContent = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));

      // execCommand('insertText') fires the full browser input event pipeline
      // that React's SyntheticEvent system hooks into — this is what a real
      // user typing does, and it's the only approach that reliably updates
      // React's internal state for contenteditable elements.
      let execWorked = false;
      try {
        el.focus();
        // Select all first to ensure we're replacing any existing content
        document.execCommand("selectAll", false, null);
        execWorked = document.execCommand("insertText", false, str);
      } catch { /* execCommand may be restricted in some contexts */ }

      if (!execWorked || !el.textContent.trim()) {
        // Fallback: set textContent directly + fire InputEvent
        el.textContent = str;
        try {
          el.dispatchEvent(new InputEvent("input", {
            bubbles: true, cancelable: true, composed: true,
            data: str, inputType: "insertText",
          }));
        } catch {
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }

      // Final events to flush React state
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      _log.info(`[Fill][ContentEditable] set "${str.slice(0, 60)}"`);
      return;
    }

    // ── Standard <input> / <textarea> ────────────────────────────────────────
    const nativeSetter =
      el.tagName === "TEXTAREA"
        ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
        : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

    if (nativeSetter) nativeSetter.call(el, ""); else el.value = "";

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const code = ch.toUpperCase().charCodeAt(0);
      const kbInit = { key: ch, keyCode: code, which: code, bubbles: true, cancelable: true, composed: true };
      try { el.dispatchEvent(new KeyboardEvent("keydown", kbInit)); } catch { /* ignore */ }
      try { el.dispatchEvent(new KeyboardEvent("keypress", kbInit)); } catch { /* ignore */ }

      const partial = str.slice(0, i + 1);
      if (nativeSetter) nativeSetter.call(el, partial); else el.value = partial;

      try {
        el.dispatchEvent(new InputEvent("input", {
          bubbles: true, cancelable: true, composed: true,
          data: ch, inputType: "insertText",
        }));
      } catch { el.dispatchEvent(new Event("input", { bubbles: true })); }
      try { el.dispatchEvent(new KeyboardEvent("keyup", kbInit)); } catch { /* ignore */ }
    }

    el.dispatchEvent(new Event("change", { bubbles: true }));

    // React fiber direct onChange as hard fallback
    try {
      const fk = Object.keys(el).find(
        (k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance")
      );
      if (fk) {
        let fiber = el[fk]; let itr = 0;
        while (fiber && itr++ < 30) {
          if (typeof fiber.memoizedProps?.onChange === "function") {
            fiber.memoizedProps.onChange({ target: el, currentTarget: el, type: "change", bubbles: true, nativeEvent: { data: str } });
            break;
          }
          fiber = fiber.return;
        }
      }
    } catch { /* fiber walk must never throw */ }

    el.dispatchEvent(new Event("blur", { bubbles: true }));
    _log.info(`[Fill][KeyboardSim] filled input value="${str.slice(0, 60)}"`);
  }

  async function stepNaukriApplyLoop(panelRoot, hints, ctx) {
    const MAX_STEPS = 25;
    const documentFallback = ctx?.documentFallback === true;
    const pak = globalThis.PanelKernel;
    const d = _dbg();
    let prevSnapshot = null;
    let prevFilledCount = 0;
    let idleStreak = 0;

    for (let step = 0; step < MAX_STEPS; step++) {
      await delay(350);

      if (globalThis.__JOBPILOT_NAUKRI_ABORT__) {
        if (d && d.isEnabled()) d.log("action", "apply loop aborted by user");
        return { success: false, error: "aborted" };
      }

      const probe = probeNaukriApplied();
      if (probe.ok) {
        _logStage("done", {
          step: step + 1,
          reason: probe.reason,
          fallback: documentFallback,
        });
        if (d && d.isEnabled()) {
          d.setOverlayStatus("Completed", String(prevFilledCount));
          d.log("detect", "Success probe OK", probe.reason);
        }
        return { success: true, message: probe.reason };
      }

      // Re-query the panel every step — panelRoot may be a detached node after
      // React remounts the drawer on each chatbot answer. isConnected is the
      // native DOM property that returns false for unmounted nodes.
      const rawPanel =
        !documentFallback && pak && pak.findApplySurfaceRoot
          ? pak.findApplySurfaceRoot(hints)
          : null;

      const panel =
        rawPanel ||
        (panelRoot && panelRoot.isConnected && (!pak?.isVisible || pak.isVisible(panelRoot))
          ? panelRoot
          : null);

      if (!panel) {
        _logStage("ready", {
          step: step + 1,
          detail: "panel_not_found_or_detached",
        });
        if (d && d.isEnabled()) {
          d.log("detect", "panel detached or not found — waiting for remount", step + 1);
          d.setOverlayStatus("Waiting for panel…", "—");
        }
        await delay(500);
        const lateProbe = probeNaukriApplied();
        if (lateProbe.ok) {
          return { success: true, message: lateProbe.reason };
        }
        continue;
      }

      _lastPanelRoot = panel;
      if (d && d.isEnabled()) {
        const nFields = d.countDetectableFields(panel);
        d.log("fields", "active panel fields visible:", nFields);
        d.setFieldsFoundLine(nFields);
        d.setOverlayStatus("Fields found: " + nFields, String(nFields));
      }

      if (pak && pak.waitForMutationStability) {
        if (d && d.isEnabled() && step > 0) {
          d.log("retry", "retrying fill due to DOM change (post-mutation stability wait)");
        }
        await pak.waitForMutationStability(panel, 180, 3500);
        // Also wait for panel to contain actual interactive content.
        // Naukri streams question content asynchronously after mounting the shell.
        if (pak.waitForPanelContent) {
          await pak.waitForPanelContent(panel, 4000);
        }
      } else {
        await delay(400);
      }

      _logFieldResetsSinceSnapshot(prevSnapshot, "step " + (step + 1));

      const hooks = _formHooks();

      let didUpload = false;
      try {
        const qText = _getLastBotQuestionText(panel, pak);
        didUpload = await tryResumeUpload(panel, qText);
      } catch (e) {
        if (d) d.logError("tryResumeUpload", e);
        _log.error("tryResumeUpload threw:", e && e.message ? e.message : e);
        throw e;
      }
      if (didUpload) {
        _logStage("fill", {
          step: step + 1,
          detail: "resume_file_attached",
          fallback: documentFallback,
        });
      }

      if (d && d.isEnabled()) {
        d.setOverlayStatus("Filling…", d.countDetectableFields(panel));
        d.log("fill", "fillAllFields starting", { step: step + 1 });
      }

      let fieldsFilled = 0;
      try {
        let chatTurnFilled = 0;
        if (typeof globalThis.tryFillNaukriChatTurn === "function") {
          chatTurnFilled = globalThis.tryFillNaukriChatTurn(
            panel,
            _naukriResumeData,
            hooks,
            _naukriChatTurnState
          );
        }

        // Fallback: direct composer fill for Naukri campus chatbot.
        // Handles cases where tryFillNaukriChatTurn returns 0 because the
        // composer input is above the last .botMsg in DOM order (flex-reverse)
        // or because the input's own aria-label doesn't match FIELD_MAP.
        if (chatTurnFilled === 0) {
          chatTurnFilled = fillNaukriChatbotComposer(panel, _naukriResumeData, pak);
          if (chatTurnFilled > 0) {
            _log.info(`[Fill][ChatComposer] filled ${chatTurnFilled} field(s) via direct composer fill (step ${step + 1})`);
          }
        }

        fieldsFilled =
          (Number(chatTurnFilled) || 0) +
          fillAllFields(panel, _naukriResumeData, hooks);
      } catch (e) {
        if (d) d.logError("fillAllFields", e);
        _log.error("fillAllFields threw:", e && e.message ? e.message : e);
        throw e;
      }

      prevSnapshot = _snapshotPanelFieldValues(panel);
      prevFilledCount = fieldsFilled;

      if (fieldsFilled > 0) {
        idleStreak = 0;
        _log.info(`Filled ${fieldsFilled} fields (step ${step + 1})`);
        _logStage("fill", {
          step: step + 1,
          filled: fieldsFilled,
          fallback: documentFallback,
        });
        if (d && d.isEnabled()) {
          d.log("fill", "filled field count this step", fieldsFilled);
        }
      }
      if (didUpload) idleStreak = 0;

      const skipBtn =
        findClickableByText("Skip this question", panel) ||
        findClickableByText("Skip", panel) ||
        panel.querySelector("[class*='skip']");

      if (skipBtn && skipBtn.offsetParent !== null) {
        idleStreak = 0;
        _log.info(`Skipping question (step ${step + 1})`);
        _logStage("action", { step: step + 1, action: "skip" });
        naukriSafeClick(skipBtn, "skip_question");
        await delay(700);
        continue;
      }

      naukriNudgeAfterFill(panel, pak);
      await delay(180);

      const postTag = `s${step + 1}_post_fill`;
      if (await tryClickQuestionnaireCta(panel, pak, postTag)) {
        idleStreak = 0;
        await delay(320);
        const afterAction = await pollNaukriApplied(8000);
        if (afterAction.ok) {
          _log.info(`Success after action: ${afterAction.reason}`);
          if (d && d.isEnabled()) {
            d.setOverlayStatus("Completed", String(fieldsFilled));
            d.log("detect", "Success after CTA", afterAction.reason);
          }
          return { success: true, message: afterAction.reason };
        }
        continue;
      }

      const saveJobBtn = panel.querySelector("[class*='save-job-button']");
      if (saveJobBtn && describeCtaClickable(saveJobBtn).ok) {
        idleStreak = 0;
        _log.info(`[JobPilot][Naukri][Action] CTA click (${postTag}): save-job-button`);
        naukriSafeClick(saveJobBtn, "save_job_button");
        await delay(320);
        const afterAction = await pollNaukriApplied(8000);
        if (afterAction.ok) {
          return { success: true, message: afterAction.reason };
        }
        continue;
      }

      const unfilledInput = pak
        ? pak.deepQuerySelectorAll(
            panel,
            "input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox']), textarea"
          ).find((i) => !String(i.value || "").trim())
        : panel.querySelector(
            "input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox']), textarea"
          );

      if (unfilledInput && !String(unfilledInput.value || "").trim()) {
        idleStreak = 0;
        try {
          fillTextField(unfilledInput, _naukriResumeData, hooks);
        } catch (e) {
          if (d) d.logError("fillTextField(heuristic)", e);
          throw e;
        }
        await delay(450);
        naukriNudgeAfterFill(panel, pak);
        await delay(120);
        await tryClickQuestionnaireCta(panel, pak, `after_unfilled_input_s${step + 1}`);
        _logStage("fill", { step: step + 1, detail: "unfilled_input_heuristic" });
        await delay(900);
        continue;
      }

      const unfilledSelect = pak
        ? pak.deepQuerySelectorAll(panel, "select")[0]
        : panel.querySelector("select");
      if (unfilledSelect && !unfilledSelect.value) {
        idleStreak = 0;
        try {
          fillDropdown(unfilledSelect, _naukriResumeData, hooks);
        } catch (e) {
          if (d) d.logError("fillDropdown(heuristic)", e);
          throw e;
        }
        await delay(450);
        naukriNudgeAfterFill(panel, pak);
        await delay(120);
        await tryClickQuestionnaireCta(panel, pak, `after_unfilled_select_s${step + 1}`);
        _logStage("fill", { step: step + 1, detail: "unfilled_select_heuristic" });
        await delay(900);
        continue;
      }

      const uncheckedRadio = pak
        ? pak.deepQuerySelectorAll(
            panel,
            "input[type='radio']"
          ).find((r) => !r.checked)
        : panel.querySelector("input[type='radio']:not(:checked)");

      if (uncheckedRadio) {
        const name = uncheckedRadio.getAttribute("name");
        if (name) {
          const radios = pak
            ? pak.deepQuerySelectorAll(
                panel,
                `input[type='radio']`
              ).filter((r) => r.getAttribute("name") === name)
            : panel.querySelectorAll(
                `input[type='radio'][name='${name}']`
              );
          idleStreak = 0;
          try {
            fillRadioGroup(radios, hooks);
          } catch (e) {
            if (d) d.logError("fillRadioGroup(heuristic)", e);
            throw e;
          }
          await delay(450);
          naukriNudgeAfterFill(panel, pak);
          await delay(120);
          await tryClickQuestionnaireCta(panel, pak, `after_radio_s${step + 1}`);
          await delay(900);
          continue;
        }
      }

      idleStreak++;
      _logStage("action", {
        step: step + 1,
        detail: "idle_wait",
        idleStreak,
      });
      _log.info(
        `[JobPilot][Naukri][Action] idle_wait streak=${idleStreak} (step ${step + 1})`
      );
      if (d && d.isEnabled()) {
        d.setOverlayStatus("Idle wait (step " + (step + 1) + ")", d.countDetectableFields(panel));
      }

      if (idleStreak >= 2) {
        naukriNudgeAfterFill(panel, pak);
        await delay(220);
        if (await tryClickQuestionnaireCta(panel, pak, `idle_break_s${step + 1}`)) {
          idleStreak = 0;
          await delay(320);
          const afterIdle = await pollNaukriApplied(8000);
          if (afterIdle.ok) {
            return { success: true, message: afterIdle.reason };
          }
          continue;
        }
      }

      await delay(900);
    }

    return await finalNaukriCheck("Could not complete questionnaire");
  }

  // ── Success Detection ──────────────────────────────────────────────────────

  /** True if primary apply CTA reads as applied (avoid matching random page copy). */
  function naukriApplyButtonShowsApplied(btn) {
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

  /** Success copy that must appear inside apply UI, not whole JD page (reduces false positives). */
  function naukriScopedSuccessPhraseRoots() {
    try {
      return document.querySelectorAll(
        "[role='dialog'],#apply_dialog," +
          "[class*='chatbot_Drawer'],[class*='chatbot'],[class*='ChatBot']," +
          "[class*='apply-sidebar'],[class*='applyModule'],[class*='quickApply']," +
          "[class*='apply-drawer']"
      );
    } catch {
      return [];
    }
  }

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
        } catch {
          /* ignore loose string match — caused false "applied" on JD pages */
        }
      }
    } catch {}

    if (
      document.querySelector(
        ".styles_already-applied__MMRPM, .already-applied, " +
          "[class*='alreadyApplied'], [class*='already_applied']"
      )
    ) {
      return { ok: true, reason: "dom_already_applied" };
    }

    const btnSelectors = [
      "#apply-button",
      ".apply-button",
      "[class*='apply-btn']",
      "[class*='applyButton']",
    ];
    for (const sel of btnSelectors) {
      const btn = document.querySelector(sel);
      if (btn && naukriApplyButtonShowsApplied(btn)) {
        return { ok: true, reason: "button_text_applied" };
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
    for (const root of naukriScopedSuccessPhraseRoots()) {
      const chunk = (root.innerText || "").toLowerCase();
      if (chunk.length > 8000) continue;
      for (const phrase of overlayPhrases) {
        if (chunk.includes(phrase))
          return { ok: true, reason: `scoped_text:"${phrase}"` };
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
    const dbg = _dbg();
    const lastCheck = await pollNaukriApplied(5000);
    if (lastCheck.ok) {
      _log.info(`Failure overridden by final probe: ${lastCheck.reason}`);
      if (dbg && dbg.isEnabled()) dbg.setOverlayStatus("Completed (late probe)", "—");
      return { success: true, message: lastCheck.reason };
    }
    _log.warn(`Failure confirmed: ${errorMessage}`);
    if (dbg && dbg.isEnabled()) {
      dbg.log("detect", "final check: failure", errorMessage);
      dbg.setOverlayStatus("Failed: " + errorMessage.slice(0, 80), "—");
    }
    return { success: false, error: errorMessage };
  }
}
