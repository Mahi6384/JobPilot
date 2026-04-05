if (!globalThis.__JOBPILOT_LI_INIT__) {
  globalThis.__JOBPILOT_LI_INIT__ = true;

  const TAG = "[JobPilot][LinkedIn]";
  const log = {
    info: (...a) => console.log(TAG, ...a),
    warn: (...a) => console.warn(TAG, ...a),
    error: (...a) => console.error(TAG, ...a),
  };

  let _resumeData = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "applyToJob") {
      _resumeData = message.resumeData || null;
      log.info("Received applyToJob message");
      runWithTimeout(applyToJob, 80000)
        .then((result) => {
          log.info("Apply flow resolved:", JSON.stringify(result));
          sendResponse(result);
        })
        .catch((err) => {
          log.error("Apply flow rejected:", err.message);
          const finalCheck = detectSubmissionSuccess() || detectAlreadyApplied();
          if (finalCheck) {
            log.info("Error caught BUT success detected on page — reporting success");
            sendResponse({ success: true, message: "success_after_error" });
          } else {
            sendResponse({ success: false, error: err.message });
          }
        });
      return true;
    }
  });

  function runWithTimeout(fn, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        log.warn("Timeout reached — running final success probe");
        if (detectSubmissionSuccess() || detectAlreadyApplied()) {
          resolve({ success: true, message: "success_at_timeout" });
        } else {
          reject(new Error("Apply flow timed out"));
        }
      }, ms);
      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  // ── Main Flow ──────────────────────────────────────────────────────────────

  async function applyToJob() {
    log.info("Starting LinkedIn Easy Apply flow");

    if (detectAlreadyApplied()) {
      log.info("Already applied to this job");
      return { success: true, message: "already_applied" };
    }

    const easyApplyBtn = findEasyApplyButton();
    if (!easyApplyBtn) {
      return {
        success: false,
        error: "No Easy Apply button found",
        skip: true,
      };
    }

    log.info("Clicking Easy Apply button");
    safeClickElement(easyApplyBtn);
    await _delay(2500);

    if (detectAlreadyApplied()) {
      log.info("Instant apply succeeded (1-click)");
      return { success: true, message: "instant_apply" };
    }

    const modal = await waitForModal(10000);
    if (!modal) {
      if (detectAlreadyApplied() || detectSubmissionSuccess()) {
        return { success: true, message: "applied_no_modal" };
      }
      return { success: false, error: "Easy Apply modal did not appear" };
    }

    log.info("Modal detected — entering multi-step flow");
    return await handleMultiStepModal(modal);
  }

  // ── Multi-Step Modal ───────────────────────────────────────────────────────

  async function handleMultiStepModal(_initialModal) {
    const MAX_STEPS = 20;

    for (let step = 0; step < MAX_STEPS; step++) {
      await _delay(1500);

      // Check for success at start of each iteration
      if (detectSubmissionSuccess()) {
        log.info("Submission success detected in modal loop");
        dismissPostSubmit();
        return { success: true, message: "application_submitted" };
      }

      if (detectAlreadyApplied()) {
        log.info("Already-applied detected in modal loop");
        return { success: true, message: "already_applied_in_loop" };
      }

      const modal = findModal();
      if (!modal) {
        await _delay(2500);
        if (detectSubmissionSuccess() || detectAlreadyApplied()) {
          return { success: true, message: "applied_modal_closed" };
        }
        return { success: false, error: "Modal closed unexpectedly" };
      }

      // Fill form fields
      const fieldCount = fillModalFields(modal);
      if (fieldCount > 0) {
        log.info(`Step ${step + 1}: filled ${fieldCount} fields`);
        await _delay(800);
      }

      // Check for errors/validation messages after filling
      dismissErrors(modal);

      // Priority 1: Submit button
      const submitBtn = findButtonInModal(modal, [
        "Submit application",
        "Submit",
      ]);
      if (submitBtn) {
        log.info("Clicking Submit application");
        safeClickElement(submitBtn);
        await _delay(4000);

        if (detectSubmissionSuccess() || detectAlreadyApplied()) {
          dismissPostSubmit();
          return { success: true, message: "submitted" };
        }

        // Wait a bit more — LinkedIn can be slow
        await _delay(3000);
        if (detectSubmissionSuccess() || detectAlreadyApplied()) {
          dismissPostSubmit();
          return { success: true, message: "submitted_delayed" };
        }

        // Check if modal is still showing with errors (NOT success)
        const stillModal = findModal();
        if (stillModal) {
          const hasError = stillModal.querySelector(
            ".artdeco-inline-feedback--error, [data-test-form-element-error], .fb-dash-form-element__error-field"
          );
          if (hasError) {
            log.warn("Submit clicked but validation errors remain");
            return {
              success: false,
              error: "Form validation errors after submit",
            };
          }
        }

        // Modal gone but no success text? Check once more
        await _delay(2000);
        if (detectSubmissionSuccess() || detectAlreadyApplied()) {
          dismissPostSubmit();
          return { success: true, message: "submitted_final_check" };
        }

        // If modal is truly gone, that's a good sign
        if (!findModal()) {
          log.info("Modal closed after submit — treating as success");
          return { success: true, message: "modal_closed_after_submit" };
        }

        log.warn("Submit clicked but could not verify — continuing loop");
        continue;
      }

      // Priority 2: Review button
      const reviewBtn = findButtonInModal(modal, [
        "Review your application",
        "Review",
      ]);
      if (reviewBtn) {
        log.info("Clicking Review");
        safeClickElement(reviewBtn);
        await _delay(1500);
        continue;
      }

      // Priority 3: Next button
      const nextBtn = findButtonInModal(modal, [
        "Continue to next step",
        "Next",
      ]);
      if (nextBtn) {
        // Check if there are blocking required fields
        if (hasBlockingRequiredFields(modal)) {
          fillModalFields(modal);
          await _delay(600);
          if (hasBlockingRequiredFields(modal)) {
            // Try to fill unfilled required fields with safe defaults
            fillRequiredFieldsWithDefaults(modal);
            await _delay(400);
            if (hasBlockingRequiredFields(modal)) {
              log.warn("Required fields could not be filled — skipping job");
              dismissModal(modal);
              return {
                success: false,
                error: "Required fields could not be auto-filled",
              };
            }
          }
        }
        log.info("Clicking Next");
        safeClickElement(nextBtn);
        await _delay(1500);
        continue;
      }

      // Priority 4: Any other forward-moving button
      const fallbackBtn = findFallbackButton(modal);
      if (fallbackBtn) {
        log.info(`Clicking fallback: "${fallbackBtn.textContent.trim()}"`);
        safeClickElement(fallbackBtn);
        await _delay(1500);
        continue;
      }

      log.warn(`No actionable button in step ${step + 1} — waiting extra`);
      await _delay(2000);
    }

    // Final check after loop exhaustion
    await _delay(2000);
    if (detectSubmissionSuccess() || detectAlreadyApplied()) {
      dismissPostSubmit();
      return { success: true, message: "submitted_after_loop" };
    }

    return { success: false, error: "Could not complete Easy Apply modal" };
  }

  // ── Form Filling ───────────────────────────────────────────────────────────

  function fillModalFields(modal) {
    let filled = 0;

    modal.querySelectorAll("input, textarea, select").forEach((field) => {
      if (field.type === "hidden" || field.type === "file") return;
      if (field.type === "radio" || field.type === "checkbox") return;

      // Handle native <select>
      if (field.tagName === "SELECT") {
        if (fillDropdown(field, _resumeData)) filled++;
        return;
      }

      // Skip already-filled fields
      if (field.value && field.value.trim() !== "") return;

      // Check if this is a typeahead/autocomplete input
      if (isLinkedInTypeahead(field)) {
        const label = getFieldLabel(field);
        const mapped = matchFieldToKey(label);
        if (mapped) {
          const value = resolveValue(mapped.key, _resumeData, mapped.fallback);
          if (value) {
            fillTypeaheadField(field, value);
            filled++;
          }
        }
      } else {
        if (fillTextField(field, _resumeData)) filled++;
      }
    });

    // Handle radio groups
    filled += fillUncheckedRadios(modal);

    return filled;
  }

  function fillUncheckedRadios(modal) {
    let filled = 0;
    const handled = new Set();

    modal.querySelectorAll("fieldset").forEach((fs) => {
      const radios = fs.querySelectorAll("input[type='radio']");
      if (radios.length === 0) return;
      
      const name = radios[0].getAttribute("name");
      if (name) handled.add(name);

      if (fillRadioGroup(radios)) filled++;
    });

    // Handle radio groups not inside fieldsets
    const radioGroups = new Map();
    modal.querySelectorAll("input[type='radio']").forEach((r) => {
      const name = r.getAttribute("name");
      if (!name || handled.has(name) || radioGroups.has(name)) return;
      radioGroups.set(
        name,
        modal.querySelectorAll(`input[type='radio'][name='${name}']`)
      );
    });
    
    radioGroups.forEach((radios) => {
      if (fillRadioGroup(radios)) filled++;
    });

    return filled;
  }

  function fillLinkedInCustomDropdowns(modal) {
    let filled = 0;

    // LinkedIn uses custom dropdown components with role="listbox" / "combobox"
    modal
      .querySelectorAll(
        "select:not([data-jp-filled]), [data-test-text-selectable-option]"
      )
      .forEach((el) => {
        if (el.tagName === "SELECT" && el.selectedIndex > 0) return;
        // Already handled native selects above
      });

    return filled;
  }

  // ── Typeahead Handling ─────────────────────────────────────────────────────

  function isLinkedInTypeahead(field) {
    if (field.getAttribute("role") === "combobox") return true;
    const wrapper =
      field.closest("[class*='typeahead']") ||
      field.closest("[class*='autocomplete']") ||
      field.closest("[class*='text-entity-list-text-input']");
    return !!wrapper;
  }

  async function fillTypeaheadField(field, value) {
    log.info(`Filling typeahead with: "${value}"`);

    // Focus and clear
    field.focus();
    setNativeValue(field, "");
    await _delay(200);

    // Type character by character (abbreviated — just set value and trigger events)
    setNativeValue(field, value);
    await _delay(800);

    // Try to select the first dropdown option
    const dropdown =
      document.querySelector("ul[role='listbox']") ||
      document.querySelector("[class*='typeahead-results']") ||
      document.querySelector("[class*='basic-typeahead']");

    if (dropdown) {
      const firstOption = dropdown.querySelector(
        "[role='option'], li, [class*='typeahead__option']"
      );
      if (firstOption) {
        log.info("Selecting first typeahead option");
        firstOption.click();
        await _delay(300);
        return;
      }
    }

    // If no dropdown appeared, dispatch Enter to confirm
    field.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        bubbles: true,
      })
    );
  }

  // ── Fill required fields with safe defaults ────────────────────────────────

  function fillRequiredFieldsWithDefaults(modal) {
    modal
      .querySelectorAll(
        "input[required], select[required], textarea[required], [aria-required='true']"
      )
      .forEach((field) => {
        if (field.type === "hidden" || field.type === "file") return;
        if (field.value && field.value.trim() !== "") return;

        if (field.tagName === "SELECT") {
          fillDropdown(field, _resumeData); // Fallback to first option
          return;
        }

        if (field.type === "radio" || field.type === "checkbox") return;

        // Assign a safe default value based on input type
        let defaultVal = "0";
        if (field.type === "number") defaultVal = "0";
        else if (field.type === "tel") defaultVal = _resumeData?.phone || "0";
        else if (field.type === "email")
          defaultVal = _resumeData?.email || "na@na.com";
        else if (field.type === "url")
          defaultVal = _resumeData?.linkedinUrl || "https://linkedin.com";
        else defaultVal = "N/A";

        setNativeValue(field, defaultVal);
        log.info(
          `Default-filled required field "${getFieldLabel(field)}" with "${defaultVal}"`
        );
      });
  }

  // Removed redundant helper functions that are now handled by shared utils:
  // getLinkedInLabel, mapField, setFieldValue, fillLinkedInDropdown


  // ── Required Fields ────────────────────────────────────────────────────────

  function hasBlockingRequiredFields(modal) {
    const required = modal.querySelectorAll(
      "input[required], select[required], textarea[required]"
    );
    for (const field of required) {
      if (field.type === "hidden" || field.type === "file") continue;
      if (field.type === "radio") {
        // Check if any radio in the group is checked
        const name = field.getAttribute("name");
        if (name) {
          const group = modal.querySelectorAll(
            `input[type='radio'][name='${name}']`
          );
          if (Array.from(group).some((r) => r.checked)) continue;
        }
        return true;
      }
      if (!field.value || field.value.trim() === "") return true;
    }

    // Also check LinkedIn's custom required indicators
    const customRequired = modal.querySelectorAll(
      "[data-test-form-element] [aria-required='true']"
    );
    for (const field of customRequired) {
      if (field.tagName === "INPUT" || field.tagName === "TEXTAREA") {
        if (!field.value || field.value.trim() === "") return true;
      }
    }

    return false;
  }

  // ── Button Finders ─────────────────────────────────────────────────────────

  function findEasyApplyButton() {
    // Strategy 1: aria-label match (case insensitive)
    const byAria = document.querySelector(
      'button[aria-label*="Easy Apply" i]'
    );
    if (byAria && isVisible(byAria) && !byAria.disabled) return byAria;

    // Strategy 2: LinkedIn-specific class selectors
    const byClass = document.querySelector(
      ".jobs-apply-button, .jobs-apply-button--top-card, [class*='jobs-apply-button']"
    );
    if (byClass && isVisible(byClass) && !byClass.disabled) {
      const text = normalizeText(byClass.textContent);
      if (text.includes("easy apply") || text === "apply") return byClass;
    }

    // Strategy 3: Text content matching on all buttons
    const buttons = document.querySelectorAll(
      "button, [role='button'], a.artdeco-button"
    );
    for (const btn of buttons) {
      if (btn.closest("header, nav, #global-nav")) continue;
      if (btn.disabled || !isVisible(btn)) continue;
      const text = normalizeText(btn.textContent);
      if (text === "easy apply" || text.startsWith("easy apply")) return btn;
    }

    // Strategy 4: SVG icon-based detection (Easy Apply has a special icon)
    const allBtns = document.querySelectorAll("button");
    for (const btn of allBtns) {
      if (!isVisible(btn) || btn.disabled) continue;
      const svg = btn.querySelector("li-icon[type='apply-dash']");
      if (svg) return btn;
    }

    return null;
  }

  function findModal() {
    // Strategy 1: LinkedIn's specific easy-apply modal class
    const specific = document.querySelector(
      ".jobs-easy-apply-modal, .jobs-easy-apply-content"
    );
    if (specific) {
      const modal = specific.closest(
        '.artdeco-modal[role="dialog"], [role="dialog"], .artdeco-modal'
      );
      return modal || specific;
    }

    // Strategy 2: artdeco modal with easy-apply related content
    const modals = document.querySelectorAll(
      '.artdeco-modal[role="dialog"], [role="dialog"].artdeco-modal, .artdeco-modal--is-open'
    );
    for (const m of modals) {
      if (!isVisible(m)) continue;
      const text = m.textContent.toLowerCase();
      if (
        text.includes("easy apply") ||
        text.includes("submit application") ||
        m.querySelector(".jobs-easy-apply-content, [class*='easy-apply']")
      ) {
        return m;
      }
    }

    // Strategy 3: Any visible dialog that contains form elements
    for (const m of modals) {
      if (!isVisible(m)) continue;
      const hasForm =
        m.querySelector("input, select, textarea, form") ||
        m.querySelector("button[aria-label*='Submit']") ||
        m.querySelector("button[aria-label*='Next']");
      if (hasForm) return m;
    }

    // Strategy 4: data-test-modal
    const dataModal = document.querySelector(
      "[data-test-modal][class*='easy-apply'], [data-test-modal]"
    );
    if (dataModal && isVisible(dataModal)) return dataModal;

    return null;
  }

  function waitForModal(timeoutMs) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const check = setInterval(() => {
        const modal = findModal();
        if (modal) {
          clearInterval(check);
          resolve(modal);
        } else if (Date.now() > deadline) {
          clearInterval(check);
          resolve(null);
        }
      }, 400);
    });
  }

  /**
   * Flexible button finder: matches by aria-label OR visible text content.
   * Case-insensitive, uses includes() rather than exact match.
   */
  function findButtonInModal(modal, labels) {
    if (!modal) return null;

    const buttons = modal.querySelectorAll("button");

    for (const label of labels) {
      const lower = label.toLowerCase();

      // Try aria-label first (case-insensitive includes)
      for (const btn of buttons) {
        if (btn.disabled || !isVisible(btn)) continue;
        const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (ariaLabel.includes(lower) || ariaLabel === lower) return btn;
      }

      // Try visible text content
      for (const btn of buttons) {
        if (btn.disabled || !isVisible(btn)) continue;
        const text = normalizeText(btn.textContent);
        if (text === lower || text.includes(lower)) return btn;
      }
    }

    return null;
  }

  function findFallbackButton(modal) {
    const labels = [
      "Next",
      "Continue",
      "Review",
      "Submit application",
      "Submit",
      "Save",
    ];

    for (const text of labels) {
      const lower = text.toLowerCase();
      const buttons = modal.querySelectorAll("button");
      for (const btn of buttons) {
        if (btn.disabled || !isVisible(btn)) continue;
        const btnText = normalizeText(btn.textContent);
        if (btnText === lower || btnText.includes(lower)) return btn;
      }
    }
    return null;
  }

  // ── Status Detection ───────────────────────────────────────────────────────

  function detectAlreadyApplied() {
    // Check for "Applied" badge / text on the page
    const selectors = [
      ".artdeco-inline-feedback",
      "[class*='applied']",
      "[class*='success']",
      "[class*='confirmation']",
      "[class*='post-apply']",
      ".jobs-details-top-card__apply-status",
    ];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const text = el.textContent.toLowerCase();
        if (
          text.includes("application submitted") ||
          text.includes("already applied") ||
          text.includes("your application was sent") ||
          text.includes("application was submitted") ||
          text.includes("application received") ||
          text.includes("applied")
        )
          return true;
      }
    }

    // Check if the Easy Apply button text changed to "Applied"
    const btns = document.querySelectorAll(
      ".jobs-apply-button, [class*='jobs-apply-button'], button[aria-label*='Easy Apply' i]"
    );
    for (const btn of btns) {
      const text = normalizeText(btn.textContent);
      if (text === "applied" || text.includes("applied")) return true;
    }

    // Check page body text
    const pageText = (document.body?.innerText || "").toLowerCase();
    if (
      pageText.includes("your application was sent") ||
      pageText.includes("application submitted")
    )
      return true;

    return false;
  }

  function detectSubmissionSuccess() {
    // Check for LinkedIn's post-apply confirmation UI elements
    const successSelectors = [
      ".artdeco-inline-feedback--success",
      ".jpac-modal-confirm",
      "[class*='post-apply']",
      "[data-test-modal-close-btn]",
      ".artdeco-modal [class*='success']",
      ".jobs-post-apply-modal",
      "[class*='post-apply-modal']",
      "[data-test-post-apply-modal]",
    ];
    for (const sel of successSelectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (
          el.closest(".artdeco-modal") ||
          el.closest("[role='dialog']") ||
          el.closest("body")
        )
          return true;
      }
    }

    // Check dialogs for success text
    const dialogs = document.querySelectorAll(
      ".artdeco-modal, [role='dialog']"
    );
    for (const dialog of dialogs) {
      if (!isVisible(dialog)) continue;
      const text = dialog.textContent.toLowerCase();
      if (
        text.includes("application submitted") ||
        text.includes("application was sent") ||
        text.includes("your application has been submitted") ||
        text.includes("application was submitted") ||
        text.includes("application received") ||
        text.includes("your application was sent")
      )
        return true;
    }

    return false;
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  function normalizeText(str) {
    return (str || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null && el.style?.position !== "fixed") return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function safeClickElement(el) {
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    // Use both click methods for reliability
    el.click();
    el.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
  }

  function dismissPostSubmit() {
    setTimeout(() => {
      const btns = document.querySelectorAll(
        'button[aria-label="Dismiss"], [data-test-modal-close-btn], ' +
          'button[aria-label="Done"], button[aria-label="Close"]'
      );
      for (const btn of btns) {
        if (isVisible(btn)) {
          btn.click();
          break;
        }
      }
    }, 1500);
  }

  function dismissModal(modal) {
    if (!modal) return;
    const closeBtn = modal.querySelector(
      'button[aria-label="Dismiss"], button[aria-label="Close"], ' +
        "[data-test-modal-close-btn]"
    );
    if (closeBtn) closeBtn.click();
  }

  function dismissErrors(modal) {
    // Click "Discard" if an unsaved changes dialog appears
    const discardBtn = findButtonInModal(modal, ["Discard"]);
    if (discardBtn) {
      log.info("Dismissing unsaved changes dialog");
      safeClickElement(discardBtn);
    }
  }

  function _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
