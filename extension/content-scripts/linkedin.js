if (!globalThis.__JOBPILOT_LI_INIT__) {
  globalThis.__JOBPILOT_LI_INIT__ = true;

  const TAG = "[JobPilot][LinkedIn]";
  const log = {
    info: (...a) => console.log(TAG, ...a),
    warn: (...a) => console.warn(TAG, ...a),
    error: (...a) => console.error(TAG, ...a),
  };

  const TIMEOUT_MS = 80000;
  const MAX_MODAL_STEPS = 25;

  let _resumeData = null;
  let _jobContext = null;

  const YES_NO_DEFAULTS = {
    authorize: "Yes",
    authorized: "Yes",
    legally: "Yes",
    "right to work": "Yes",
    "work permit": "Yes",
    "eligible to work": "Yes",
    sponsorship: "No",
    "require sponsorship": "No",
    "need sponsorship": "No",
    "visa sponsor": "No",
    relocate: "Yes",
    "willing to relocate": "Yes",
    commute: "Yes",
    "willing to commute": "Yes",
    "background check": "Yes",
    "drug test": "Yes",
    "non-compete": "No",
    "non compete": "No",
    "18 years": "Yes",
    "over 18": "Yes",
  };

  log.info("Content script loaded", {
    url: location.href,
    readyState: document.readyState,
    isTopFrame: window === window.top,
  });

  // ── Shadow DOM Access ───────────────────────────────────────────────────
  // LinkedIn 2025+ renders the Easy Apply modal inside a Shadow DOM
  // attached to div#interop-outlet. Regular document.querySelector cannot
  // see inside it, so every query must go through getShadowRoot().

  function getShadowRoot() {
    const host = document.getElementById("interop-outlet");
    return host?.shadowRoot || null;
  }

  function queryShadow(selector) {
    const sr = getShadowRoot();
    return sr ? sr.querySelector(selector) : null;
  }

  function queryAllShadow(selector) {
    const sr = getShadowRoot();
    return sr ? sr.querySelectorAll(selector) : [];
  }

  // ── Message Listener ──────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    log.info("Message received:", message.action);
    if (message.action !== "applyToJob") return;

    _resumeData = message.resumeData || null;
    _jobContext = message.jobContext || null;
    log.info("Received applyToJob", {
      hasResumeData: !!_resumeData,
      resumeKeys: _resumeData ? Object.keys(_resumeData) : [],
      url: location.href,
    });

    withTimeout(applyToJob(), TIMEOUT_MS)
      .then((result) => {
        log.info("Result:", JSON.stringify(result));
        sendResponse(result);
      })
      .catch((err) => {
        log.error("Error:", err.message);
        sendResponse(
          detectSuccess()
            ? { success: true, message: "success_after_error" }
            : { success: false, error: err.message }
        );
      });

    return true;
  });

  // ── Main Apply Flow ───────────────────────────────────────────────────────

  async function applyToJob() {
    log.info("=== APPLY FLOW START ===", { url: location.href });

    if (detectAlreadyApplied()) {
      return { success: true, message: "already_applied" };
    }

    await ensurePageLoaded();
    await _delay(3000);

    const easyApplyBtn = await findEasyApplyButton(25000);
    if (!easyApplyBtn) {
      return { success: false, error: "No Easy Apply button found", skip: true };
    }

    log.info("Easy Apply button found", describeEl(easyApplyBtn));

    clickElement(easyApplyBtn);
    log.info("Click dispatched — waiting for modal...");
    await _delay(2500);

    if (detectAlreadyApplied()) {
      return { success: true, message: "instant_apply" };
    }

    const modal = await waitForModal(15000);
    if (!modal) {
      log.error("Modal NOT found after 15s");
      log.info("Shadow root exists:", !!getShadowRoot());
      return detectSuccess()
        ? { success: true, message: "applied_no_modal" }
        : { success: false, error: "Easy Apply modal did not appear" };
    }

    log.info("=== MODAL FOUND ===", {
      tag: modal.tagName,
      class: (modal.className?.toString?.() || "").slice(0, 200),
      role: modal.getAttribute("role"),
      headerText: getModalHeaderText(modal),
    });

    return await stepThroughModal();
  }

  // ── Modal Detection (LinkedIn 2025 Shadow DOM) ────────────────────────────
  // The modal is: div.artdeco-modal.jobs-easy-apply-modal[role="dialog"]
  // inside #interop-outlet's shadowRoot.

  function getVisibleModal() {
    // Primary: search inside Shadow DOM (LinkedIn 2025+)
    const sr = getShadowRoot();
    if (sr) {
      const modal =
        sr.querySelector(".jobs-easy-apply-modal") ||
        sr.querySelector('.artdeco-modal[role="dialog"]') ||
        sr.querySelector('[role="dialog"]');
      if (modal && isVisible(modal)) {
        return modal;
      }
    }

    // Fallback: search in light DOM (older LinkedIn or different layouts)
    for (const sel of [
      ".jobs-easy-apply-modal",
      ".jobs-easy-apply-content",
      '.artdeco-modal[role="dialog"]',
      '[role="dialog"]',
    ]) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) {
        const text = (el.textContent || "").toLowerCase();
        if (
          text.includes("apply to") ||
          text.includes("easy apply") ||
          text.includes("contact info") ||
          el.querySelector("input, select, textarea")
        ) {
          return el;
        }
      }
    }

    return null;
  }

  function waitForModal(timeoutMs) {
    return new Promise((resolve) => {
      const found = getVisibleModal();
      if (found) {
        log.info("waitForModal: found immediately");
        return resolve(found);
      }

      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (observer) observer.disconnect();
        if (shadowObserver) shadowObserver.disconnect();
        clearTimeout(timer);
        clearInterval(poller);
        resolve(result);
      };

      const check = () => {
        const modal = getVisibleModal();
        if (modal) finish(modal);
      };

      // Observe light DOM mutations
      const observer = new MutationObserver(check);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "role", "aria-hidden", "style"],
      });

      // Observe shadow DOM mutations if available
      let shadowObserver = null;
      const sr = getShadowRoot();
      if (sr) {
        shadowObserver = new MutationObserver(check);
        shadowObserver.observe(sr, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "role", "aria-hidden", "style"],
        });
      }

      const poller = setInterval(check, 500);

      const timer = setTimeout(() => {
        log.warn("waitForModal: timeout — final scan");
        finish(getVisibleModal());
      }, timeoutMs);
    });
  }

  function getModalHeaderText(modal) {
    if (!modal) return "";
    const h = modal.querySelector("h2, h3, h1, [class*='title']");
    return h ? h.textContent.trim().slice(0, 100) : "";
  }

  // ── Modal Stepper ─────────────────────────────────────────────────────────

  async function stepThroughModal() {
    for (let step = 0; step < MAX_MODAL_STEPS; step++) {
      await _delay(1500);

      if (detectSuccess()) {
        log.info(`Step ${step + 1}: SUCCESS detected`);
        dismissPostSubmitDialog();
        return { success: true, message: "application_submitted" };
      }

      if (detectAlreadyApplied()) {
        return { success: true, message: "already_applied_in_loop" };
      }

      const modal = getVisibleModal();
      if (!modal) {
        await _delay(2500);
        return detectSuccess()
          ? { success: true, message: "applied_modal_closed" }
          : { success: false, error: "Modal closed unexpectedly" };
      }

      log.info(`Step ${step + 1}: header = "${getModalHeaderText(modal)}"`);

      if (handleDiscardDialog(modal)) {
        await _delay(1000);
        continue;
      }

      const fieldCount = await fillFormFields(modal);
      log.info(`Step ${step + 1}: filled ${fieldCount} field(s)`);
      if (fieldCount > 0) await _delay(800);

      const errors = modal.querySelectorAll(
        ".artdeco-inline-feedback--error, [data-test-form-element-error], " +
        ".fb-dash-form-element__error-field"
      );
      if (errors.length > 0) {
        log.warn(`Step ${step + 1}: ${errors.length} error(s) — re-filling`);
        await fillFormFields(modal);
        await _delay(500);
        fillRequiredWithDefaults(modal);
        await _delay(500);
      }

      const action = pickModalAction(modal);
      log.info(`Step ${step + 1}: action = ${action.type}`, action.btn ? {
        btnText: action.btn.textContent?.trim()?.slice(0, 60),
        btnAria: action.btn.getAttribute("aria-label"),
      } : {});

      if (action.type === "submit") {
        clickElement(action.btn);
        const submitted = await confirmSubmission();
        if (submitted) return submitted;
        continue;
      }

      if (action.type === "review") {
        clickElement(action.btn);
        await _delay(2000);
        continue;
      }

      if (action.type === "next") {
        if (hasEmptyRequiredFields(modal)) {
          log.info("Required fields empty — filling defaults");
          await fillFormFields(modal);
          await _delay(600);
          fillRequiredWithDefaults(modal);
          await _delay(400);
        }
        clickElement(action.btn);
        await _delay(2000);

        const postClickModal = getVisibleModal();
        if (postClickModal) {
          const postErrors = postClickModal.querySelectorAll(
            ".artdeco-inline-feedback--error"
          );
          if (postErrors.length > 0) {
            log.warn("Errors after Next — re-filling");
            await fillFormFields(postClickModal);
            fillRequiredWithDefaults(postClickModal);
            await _delay(500);
          }
        }
        continue;
      }

      if (action.type === "fallback") {
        clickElement(action.btn);
        await _delay(2000);
        continue;
      }

      log.warn(`Step ${step + 1}: no actionable button — waiting`);
      await _delay(2500);
    }

    await _delay(2000);
    if (detectSuccess()) {
      dismissPostSubmitDialog();
      return { success: true, message: "submitted_after_loop" };
    }

    return { success: false, error: "Could not complete Easy Apply modal" };
  }

  async function confirmSubmission() {
    for (const waitMs of [4000, 3000, 2000]) {
      await _delay(waitMs);
      if (detectSuccess()) {
        dismissPostSubmitDialog();
        return { success: true, message: "submitted" };
      }
    }

    const stillOpen = getVisibleModal();
    if (stillOpen) {
      const hasError = stillOpen.querySelector(
        ".artdeco-inline-feedback--error, [data-test-form-element-error]"
      );
      if (hasError) {
        log.warn("Validation errors after submit");
        return null;
      }
    }

    if (!getVisibleModal()) {
      return { success: true, message: "modal_closed_after_submit" };
    }

    log.warn("Submit unverified — continuing");
    return null;
  }

  function pickModalAction(modal) {
    // LinkedIn 2025 buttons:
    //   Submit: aria-label="Submit application", text "Submit application"
    //   Review: aria-label="Review your application", text "Review"
    //   Next:   aria-label="Continue to next step", text "Next"
    //   Dismiss: class artdeco-modal__dismiss, aria-label="Dismiss"

    const submit = findButtonInContainer(modal, [
      "Submit application", "Submit",
    ]);
    if (submit) return { type: "submit", btn: submit };

    const review = findButtonInContainer(modal, [
      "Review your application", "Review",
    ]);
    if (review) return { type: "review", btn: review };

    const next = findButtonInContainer(modal, [
      "Continue to next step", "Next",
    ]);
    if (next) return { type: "next", btn: next };

    const fallback = findButtonInContainer(modal, [
      "Continue", "Save", "Done", "Upload",
    ]);
    if (fallback) return { type: "fallback", btn: fallback };

    return { type: "none" };
  }

  // ── Form Filling ──────────────────────────────────────────────────────────

  async function fillFormFields(modal) {
    let filled = 0;

    // 1. Text inputs and textareas (class: artdeco-text-input--input)
    for (const field of modal.querySelectorAll("input, textarea")) {
      if (field.type === "hidden" || field.type === "file") continue;
      if (field.type === "radio" || field.type === "checkbox") continue;
      if (field.value && field.value.trim() !== "") continue;

      if (isTypeaheadInput(field)) {
        const label = _getFieldLabel(field);
        const mapped = matchFieldToKey(label);
        if (mapped) {
          const value = resolveValue(mapped.key, _resumeData, mapped.fallback);
          if (value) {
            await fillTypeahead(field, value);
            filled++;
            continue;
          }
        }
        const yesNo = resolveYesNoDefault(label);
        if (yesNo) {
          await fillTypeahead(field, yesNo);
          filled++;
        }
      } else {
        if (fillTextField(field, _resumeData)) {
          filled++;
          continue;
        }
        const label = _getFieldLabel(field);
        const numericVal = resolveNumericDefault(label);
        if (numericVal !== null && !field.value) {
          _setNativeValue(field, numericVal);
          log.info(`Numeric default: "${label}" → "${numericVal}"`);
          filled++;
          continue;
        }
        const yesNoVal = resolveYesNoDefault(label);
        if (yesNoVal && !field.value) {
          _setNativeValue(field, yesNoVal);
          log.info(`YesNo: "${label}" → "${yesNoVal}"`);
          filled++;
          continue;
        }

        // AI fallback: only for long-answer questions we couldn't map/fill.
        try {
          if (typeof fillLongAnswerWithAI === "function") {
            const didAI = await fillLongAnswerWithAI(
              field,
              label,
              _resumeData,
              _jobContext,
              {
                onSkip: (d) =>
                  log.info(
                    "AI skip",
                    d?.reason || "",
                    (d?.label || "").slice(0, 80)
                  ),
              }
            );
            if (didAI) {
              log.info(`AI filled: "${label}"`);
              filled++;
              continue;
            }
          }
        } catch (e) {
          log.warn("AI fill failed:", e?.message || String(e));
        }
      }
    }

    // 2. Native <select> dropdowns (class: fb-dash-form-element__select-dropdown)
    for (const sel of modal.querySelectorAll("select")) {
      if (fillDropdown(sel, _resumeData)) filled++;
    }

    // 3. LinkedIn custom dropdowns
    filled += await fillLinkedInCustomDropdowns(modal);

    // 4. Radio groups
    filled += fillAllRadioGroups(modal);

    // 5. Agreement checkboxes
    filled += fillCheckboxes(modal);

    return filled;
  }

  function fillAllRadioGroups(modal) {
    let filled = 0;
    const handledNames = new Set();

    for (const fs of modal.querySelectorAll("fieldset")) {
      const radios = fs.querySelectorAll("input[type='radio']");
      if (radios.length === 0) continue;
      const name = radios[0].getAttribute("name");
      if (name) handledNames.add(name);

      if (Array.from(radios).some((r) => r.checked)) continue;

      const label = (
        fs.querySelector("legend")?.textContent ||
        fs.querySelector("label, span")?.textContent ||
        ""
      ).toLowerCase();

      const smartPick = pickSmartRadio(radios, label);
      if (smartPick) {
        smartPick.click();
        smartPick.dispatchEvent(new Event("change", { bubbles: true }));
        filled++;
      } else if (fillRadioGroup(radios)) {
        filled++;
      }
    }

    const groups = new Map();
    for (const r of modal.querySelectorAll("input[type='radio']")) {
      const name = r.getAttribute("name");
      if (!name || handledNames.has(name)) continue;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(r);
    }

    for (const [, radios] of groups) {
      if (radios.some((r) => r.checked)) continue;
      if (fillRadioGroup(radios)) filled++;
    }

    return filled;
  }

  function pickSmartRadio(radios, questionLabel) {
    const q = questionLabel.toLowerCase();
    let preferYes = false;
    let preferNo = false;

    for (const [keyword, answer] of Object.entries(YES_NO_DEFAULTS)) {
      if (q.includes(keyword)) {
        if (answer === "Yes") preferYes = true;
        else preferNo = true;
        break;
      }
    }

    if (!preferYes && !preferNo) return null;

    for (const r of radios) {
      const rLabel = _getRadioLabel(r).toLowerCase();
      if (preferYes && (rLabel === "yes" || rLabel.startsWith("yes"))) return r;
      if (preferNo && (rLabel === "no" || rLabel.startsWith("no"))) return r;
    }
    return null;
  }

  function _getRadioLabel(radio) {
    const closest = radio.closest("label");
    if (closest) return closest.textContent.trim();
    if (radio.id) {
      const forLabel =
        radio.getRootNode().querySelector(`label[for="${radio.id}"]`);
      if (forLabel) return forLabel.textContent.trim();
    }
    return radio.value || "";
  }

  function fillCheckboxes(modal) {
    let filled = 0;
    for (const cb of modal.querySelectorAll("input[type='checkbox']")) {
      if (cb.checked) continue;
      const label = _getFieldLabel(cb).toLowerCase();
      if (
        label.includes("agree") ||
        label.includes("terms") ||
        label.includes("acknowledge") ||
        label.includes("consent") ||
        label.includes("confirm")
      ) {
        cb.click();
        cb.dispatchEvent(new Event("change", { bubbles: true }));
        filled++;
      }
    }
    return filled;
  }

  async function fillLinkedInCustomDropdowns(modal) {
    let filled = 0;

    const triggers = modal.querySelectorAll(
      '[role="combobox"], [aria-haspopup="listbox"], ' +
      'button[aria-expanded], [class*="select"][aria-expanded]'
    );

    for (const trigger of triggers) {
      if (trigger.tagName === "INPUT") continue;
      if (trigger.getAttribute("aria-expanded") === "true") continue;

      const container =
        trigger.closest(".fb-dash-form-element") ||
        trigger.closest("[class*='form-component']") ||
        trigger.closest("[class*='form-element']") ||
        trigger.closest("fieldset") ||
        trigger.parentElement;
      if (!container) continue;

      const label = (
        container.querySelector("label, legend, [class*='label']")?.textContent || ""
      ).trim();
      if (!label) continue;

      const mapped = matchFieldToKey(label);
      const desiredValue = mapped
        ? resolveValue(mapped.key, _resumeData, mapped.fallback)
        : resolveYesNoDefault(label);
      if (!desiredValue) continue;

      const currentVal = trigger.textContent?.trim();
      if (currentVal && currentVal !== "Select an option" && currentVal !== "--") continue;

      clickElement(trigger);
      await _delay(600);

      // Listbox may appear inside the shadow root
      const sr = getShadowRoot();
      const listbox =
        (sr && sr.querySelector('[role="listbox"]')) ||
        modal.querySelector('[role="listbox"]') ||
        document.querySelector('[role="listbox"]');

      if (listbox) {
        const options = listbox.querySelectorAll('[role="option"], li');
        let picked = false;
        const desiredLower = desiredValue.toLowerCase();

        for (const opt of options) {
          const optText = opt.textContent.trim().toLowerCase();
          if (optText === desiredLower || optText.includes(desiredLower) || desiredLower.includes(optText)) {
            opt.click();
            picked = true;
            filled++;
            log.info(`Custom dropdown "${label}" → "${opt.textContent.trim()}"`);
            break;
          }
        }

        if (!picked && options.length > 0) {
          options[0].click();
          filled++;
          log.info(`Custom dropdown "${label}" → first: "${options[0].textContent.trim()}"`);
        }

        await _delay(400);
      } else {
        trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await _delay(200);
      }
    }

    return filled;
  }

  function fillRequiredWithDefaults(modal) {
    for (const field of modal.querySelectorAll(
      "input[required], select[required], textarea[required], [aria-required='true']"
    )) {
      if (field.type === "hidden" || field.type === "file") continue;
      if (field.type === "radio" || field.type === "checkbox") continue;
      if (field.value && field.value.trim() !== "") continue;

      if (field.tagName === "SELECT") {
        fillDropdown(field, _resumeData);
        continue;
      }

      const label = _getFieldLabel(field);

      const numericVal = resolveNumericDefault(label);
      if (numericVal !== null) {
        _setNativeValue(field, numericVal);
        log.info(`Required numeric: "${label}" → "${numericVal}"`);
        continue;
      }

      const yesNo = resolveYesNoDefault(label);
      if (yesNo) {
        _setNativeValue(field, yesNo);
        log.info(`Required yesNo: "${label}" → "${yesNo}"`);
        continue;
      }

      if (isNumericField(field)) {
        _setNativeValue(field, "1");
        log.info(`Required (numeric field attr): "${label}" → "1"`);
        continue;
      }

      const defaults = {
        number: "1",
        tel: _resumeData?.phone || "0000000000",
        email: _resumeData?.email || "na@na.com",
        url: _resumeData?.linkedinUrl || "https://linkedin.com",
      };
      const val = defaults[field.type] || "N/A";
      _setNativeValue(field, val);
      log.info(`Required default: "${label}" → "${val}"`);
    }
  }

  function resolveYesNoDefault(label) {
    if (!label) return null;
    const lower = label.toLowerCase();
    for (const [keyword, answer] of Object.entries(YES_NO_DEFAULTS)) {
      if (lower.includes(keyword)) return answer;
    }
    return null;
  }

  function isNumericField(field) {
    if (field.type === "number") return true;
    if (field.id && field.id.endsWith("-numeric")) return true;
    const inputMode = field.getAttribute("inputmode") || "";
    if (inputMode === "numeric" || inputMode === "decimal") return true;
    const pattern = field.getAttribute("pattern") || "";
    if (/\\d|decimal|number|numeric/i.test(pattern)) return true;
    const errEl = field.closest(".fb-dash-form-element, .artdeco-text-input")
      ?.querySelector(".artdeco-inline-feedback__message, .fb-dash-form-element__error-text");
    if (errEl && /decimal|number/i.test(errEl.textContent)) return true;
    return false;
  }

  function resolveNumericDefault(label) {
    if (!label) return null;
    const lower = label.toLowerCase();

    const experiencePatterns = [
      /experience/i,
      /years?\s+(?:of\s+)?(?:work|professional|industry)/i,
      /how\s+many\s+years/i,
      /years?\s+(?:of\s+)?experience/i,
      /years?\s+(?:do\s+you\s+have|have\s+you)/i,
      /working\s+with/i,
      /proficiency/i,
    ];

    for (const pat of experiencePatterns) {
      if (pat.test(lower)) {
        const yrs = _resumeData?.experience?.years;
        return yrs ? String(yrs) : "1";
      }
    }

    if (
      lower.includes("gpa") ||
      lower.includes("cgpa") ||
      lower.includes("grade")
    ) {
      return _resumeData?.gpa || "3.5";
    }

    if (
      lower.includes("salary") ||
      lower.includes("ctc") ||
      lower.includes("compensation") ||
      lower.includes("pay") ||
      lower.includes("package") ||
      lower.includes("remuneration")
    ) {
      const hasCtc =
        /\bctc\b|\bcost\s*to\s*company\b|\blpa\b/i.test(lower);
      if (!hasCtc) return null;

      const isCurrent = /\bcurrent\b|\bpresent\b/i.test(lower);
      const isExpected =
        /\bexpected\b|\bdesired\b|\btarget\b|\bpreferred\b|\bexpectation\b|\brange\b/i.test(
          lower
        );

      // Tight rule: only fill when qualifier AND CTC are present.
      if (isCurrent && !isExpected) return _resumeData?.currentCtc || null;
      if (isExpected && !isCurrent) return _resumeData?.expectedSalary || null;
      return null;
    }

    if (
      lower.includes("decimal") ||
      lower.includes("number") ||
      lower.includes("numeric") ||
      lower.includes("how many")
    ) {
      return "1";
    }

    return null;
  }

  // ── Typeahead ─────────────────────────────────────────────────────────────

  function isTypeaheadInput(field) {
    if (field.getAttribute("role") === "combobox") return true;
    return !!(
      field.closest("[class*='typeahead']") ||
      field.closest("[class*='autocomplete']") ||
      field.closest("[class*='text-entity-list']")
    );
  }

  async function fillTypeahead(field, value) {
    log.info(`Typeahead: "${_getFieldLabel(field)}" → "${value}"`);
    field.focus();
    _setNativeValue(field, "");
    await _delay(300);
    _setNativeValue(field, value);
    await _delay(1000);

    // Listbox may be in shadow DOM
    const sr = getShadowRoot();
    const dropdown =
      (sr && sr.querySelector('[role="listbox"]')) ||
      field.getRootNode().querySelector('[role="listbox"]') ||
      document.querySelector('[role="listbox"]');

    if (dropdown) {
      const option = dropdown.querySelector("[role='option'], li");
      if (option) {
        option.click();
        await _delay(400);
        return;
      }
    }

    field.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", code: "Enter", keyCode: 13, bubbles: true,
    }));
    await _delay(300);
  }

  // ── Easy Apply Button Detection ───────────────────────────────────────────
  // The Easy Apply button is in the LIGHT DOM (not shadow), so regular
  // document.querySelector works fine here.

  async function findEasyApplyButton(timeoutMs) {
    const found = scanForEasyApply();
    if (found) return found;

    return new Promise((resolve) => {
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(result);
      };

      const poll = () => {
        const hit = scanForEasyApply();
        if (hit) finish(hit);
      };

      const observer = new MutationObserver(poll);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "aria-label", "hidden", "style"],
      });

      poll();

      const timer = setTimeout(() => {
        finish(scanForEasyApply());
      }, timeoutMs);
    });
  }

  function scanForEasyApply() {
    const root = document.body || document.documentElement;
    if (!root) return null;

    for (const sel of [
      '[aria-label*="Easy Apply" i]',
      '[aria-label*="Apply to this job" i]',
    ]) {
      try {
        for (const el of root.querySelectorAll(sel)) {
          if (isClickable(el) && !isDisabled(el)) return el;
        }
      } catch {}
    }

    for (const sel of [
      ".jobs-apply-button",
      '[class*="jobs-apply-button"]',
      '[class*="jobs-s-apply"]',
    ]) {
      try {
        for (const el of root.querySelectorAll(sel)) {
          if (isClickable(el) && !isDisabled(el)) return el;
        }
      } catch {}
    }

    for (const el of root.querySelectorAll('a, button, [role="button"]')) {
      if (!isClickable(el) || isDisabled(el)) continue;
      if (el.closest("header, nav, #global-nav, .global-nav")) continue;
      const text = _normalizeText(el.textContent);
      if (text.length > 2 && text.length < 60 && text.includes("easy apply")) {
        return el;
      }
    }

    for (const el of root.querySelectorAll("span, div")) {
      const text = _normalizeText(el.textContent);
      if (text.length > 2 && text.length < 40 && text.includes("easy apply")) {
        const target = el.closest('a, button, [role="button"]') || el;
        if (isClickable(target) && !isDisabled(target)) return target;
      }
    }

    return null;
  }

  // ── Button Finder ─────────────────────────────────────────────────────────
  // LinkedIn 2025 button classes:
  //   Primary (Next/Submit): artdeco-button--primary
  //   Tertiary (Dismiss):    artdeco-modal__dismiss
  //   aria-label is the reliable identifier

  function findButtonInContainer(container, labels) {
    if (!container) return null;
    const buttons = container.querySelectorAll("button, [role='button']");

    for (const label of labels) {
      const lower = label.toLowerCase();

      for (const btn of buttons) {
        if (btn.disabled || !isVisible(btn)) continue;
        const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (aria === lower || aria.includes(lower)) return btn;
      }

      for (const btn of buttons) {
        if (btn.disabled || !isVisible(btn)) continue;
        const text = _normalizeText(btn.textContent);
        if (text === lower) return btn;
      }

      for (const btn of buttons) {
        if (btn.disabled || !isVisible(btn)) continue;
        const text = _normalizeText(btn.textContent);
        if (text.includes(lower)) return btn;
      }
    }
    return null;
  }

  // ── Required Fields Check ─────────────────────────────────────────────────

  function hasEmptyRequiredFields(modal) {
    for (const field of modal.querySelectorAll(
      "input[required], select[required], textarea[required], [aria-required='true']"
    )) {
      if (field.type === "hidden" || field.type === "file") continue;

      if (field.type === "radio") {
        const name = field.getAttribute("name");
        if (name) {
          const group = modal.querySelectorAll(`input[type='radio'][name='${name}']`);
          if (Array.from(group).some((r) => r.checked)) continue;
        }
        return true;
      }

      if (field.type === "checkbox") continue;
      if (!field.value || field.value.trim() === "") return true;
    }
    return false;
  }

  // ── Success / Status Detection ────────────────────────────────────────────
  // Must check BOTH light DOM and shadow DOM for success indicators.

  function detectSuccess() {
    return detectSubmissionSuccess() || detectAlreadyApplied();
  }

  function detectAlreadyApplied() {
    const successTexts = [
      "application submitted", "already applied", "your application was sent",
      "application was submitted", "application received",
    ];

    const selectors = [
      ".artdeco-inline-feedback", "[class*='applied']", "[class*='success']",
      "[class*='confirmation']", "[class*='post-apply']",
      ".jobs-details-top-card__apply-status",
    ];

    // Check light DOM
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const text = el.textContent.toLowerCase();
        if (successTexts.some((t) => text.includes(t))) return true;
      }
    }

    // Check shadow DOM
    for (const sel of selectors) {
      for (const el of queryAllShadow(sel)) {
        const text = el.textContent.toLowerCase();
        if (successTexts.some((t) => text.includes(t))) return true;
      }
    }

    for (const btn of document.querySelectorAll(
      '[aria-label*="Easy Apply" i]'
    )) {
      if (_normalizeText(btn.textContent).includes("applied")) return true;
    }

    return false;
  }

  function detectSubmissionSuccess() {
    const successSelectors = [
      ".artdeco-inline-feedback--success", ".jpac-modal-confirm",
      "[class*='post-apply']", ".jobs-post-apply-modal",
      "[class*='post-apply-modal']", "[data-test-post-apply-modal]",
    ];

    for (const sel of successSelectors) {
      if (document.querySelector(sel)) return true;
      if (queryShadow(sel)) return true;
    }

    // Check dialogs in shadow DOM for success text
    for (const dialog of queryAllShadow('[role="dialog"], .artdeco-modal')) {
      if (!isVisible(dialog)) continue;
      const text = dialog.textContent.toLowerCase();
      if (
        text.includes("application submitted") ||
        text.includes("application was sent") ||
        text.includes("your application has been submitted") ||
        text.includes("application received")
      ) return true;
    }

    return false;
  }

  // ── UI Helpers ────────────────────────────────────────────────────────────

  function dismissPostSubmitDialog() {
    setTimeout(() => {
      // Check shadow DOM first (where the modal lives)
      for (const btn of queryAllShadow(
        'button[aria-label="Dismiss"], button[aria-label="Done"], ' +
        'button[aria-label="Close"], .artdeco-modal__dismiss'
      )) {
        if (isVisible(btn)) { btn.click(); return; }
      }
      // Fallback to light DOM
      for (const btn of document.querySelectorAll(
        'button[aria-label="Dismiss"], button[aria-label="Done"], ' +
        'button[aria-label="Close"]'
      )) {
        if (isVisible(btn)) { btn.click(); return; }
      }
    }, 1500);
  }

  function handleDiscardDialog(modal) {
    const text = (modal.textContent || "").toLowerCase();
    if (
      text.includes("discard") &&
      (text.includes("unsaved") || text.includes("are you sure"))
    ) {
      const discardBtn = findButtonInContainer(modal, ["Discard"]);
      if (discardBtn) {
        log.info("Dismissing discard dialog");
        clickElement(discardBtn);
        return true;
      }
    }
    return false;
  }

  // ── Core Utilities ────────────────────────────────────────────────────────

  function _delay(ms) {
    return typeof delay === "function" ? delay(ms) : new Promise((r) => setTimeout(r, ms));
  }

  function _normalizeText(str) {
    return (str || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isVisible(el) {
    if (!el) return false;
    const win = el.ownerDocument?.defaultView || window;
    if (!win) return false;
    try {
      const style = win.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (Number(style.opacity) === 0) return false;
    } catch { return false; }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isClickable(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isDisabled(el) {
    if (!el) return true;
    return el.disabled || el.getAttribute("aria-disabled") === "true";
  }

  function describeEl(el) {
    return {
      tag: el.tagName,
      text: (el.textContent || "").trim().slice(0, 80),
      class: (el.className?.toString?.() || "").slice(0, 150),
      aria: el.getAttribute("aria-label"),
      id: el.id || null,
    };
  }

  function clickElement(el) {
    if (!el) {
      log.error("clickElement: null element!");
      return;
    }

    el.scrollIntoView({ block: "center", behavior: "instant" });

    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const win = el.ownerDocument?.defaultView || window;

    const opts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: win,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      button: 0,
      buttons: 1,
    };

    el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerId: 1 }));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerId: 1 }));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
    el.click();
  }

  function _setNativeValue(el, value) {
    if (typeof setNativeValue === "function") {
      setNativeValue(el, value);
    } else {
      const setter =
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set ||
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function _getFieldLabel(field) {
    const ariaLabel = field.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel;

    const root = field.getRootNode();

    const id = field.id;
    if (id) {
      const lbl = root.querySelector(`label[for="${id}"]`);
      if (lbl) return lbl.textContent.trim();
    }

    const parent = field.closest("label");
    if (parent) return parent.textContent.trim();

    const wrapper =
      field.closest(".fb-dash-form-element") ||
      field.closest("[class*='form-component']") ||
      field.closest("[class*='form-element']") ||
      field.closest("[data-test-form-element]") ||
      field.closest("fieldset") ||
      field.closest("[class*='field']") ||
      field.closest(".jobs-easy-apply-form-element");

    if (wrapper) {
      const lbl =
        wrapper.querySelector("label") ||
        wrapper.querySelector("legend") ||
        wrapper.querySelector("[class*='label']") ||
        wrapper.querySelector("[data-test-form-element-label]");
      if (lbl) return lbl.textContent.trim();
    }

    return field.getAttribute("placeholder") || field.getAttribute("name") || "";
  }

  function ensurePageLoaded() {
    if (document.readyState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      window.addEventListener("load", done, { once: true });
      document.addEventListener("readystatechange", () => {
        if (document.readyState === "complete") done();
      });
    });
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (detectSuccess()) resolve({ success: true, message: "success_at_timeout" });
        else reject(new Error("Apply flow timed out"));
      }, ms);
      promise
        .then((r) => { clearTimeout(timer); resolve(r); })
        .catch((e) => { clearTimeout(timer); reject(e); });
    });
  }
}
