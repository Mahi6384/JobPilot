if (!globalThis.__JOBPILOT_WD_INIT__) {
  globalThis.__JOBPILOT_WD_INIT__ = true;

  const TAG = "[JobPilot][Workday]";
  const log = {
    info: (...a) => console.log(TAG, ...a),
    warn: (...a) => console.warn(TAG, ...a),
    error: (...a) => console.error(TAG, ...a),
  };

  const TIMEOUT_MS = 90000;
  const MAX_STEPS = 25;

  let _resumeData = null;
  let _resumeAttachment = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action !== "applyToJob") return;

    _resumeData = message.resumeData || null;
    _resumeAttachment = message.resumeAttachment || null;
    globalThis.__JOBPILOT_AUTOFILL_DEBUG__ = !!message.debugAutofill;

    withTimeout(runGuidedWorkdayFlow(), TIMEOUT_MS)
      .then((result) => sendResponse(result))
      .catch((err) =>
        sendResponse({ success: false, error: err?.message || String(err) })
      );

    return true;
  });

  async function runGuidedWorkdayFlow() {
    log.info("Starting guided Workday flow", {
      url: location.href,
      frame: window === window.top ? "top" : "iframe",
    });

    await ensurePageLoaded();
    await delay(1500);

    // If we are on a job posting page, attempt an initial "Apply" click.
    if (!isInApplicationFlow()) {
      const applyBtn = findButtonLike(["apply"]);
      if (applyBtn) {
        clickElement(applyBtn);
        await delay(2500);
      }
    }

    let lastStage = null;

    for (let step = 0; step < MAX_STEPS; step++) {
      await delay(1200);

      const stage = getWorkdayStageLabel();
      if (stage) log.info(`Stage: "${stage}" (step ${step + 1}/${MAX_STEPS})`);
      if (stage) lastStage = stage;

      // Stop pre-submit (guided mode).
      const submitBtn = findSubmitLikeButton();
      if (submitBtn) {
        log.info("Reached submit step — stopping (guided mode).");
        return { success: false, skip: true, error: "requires_manual_submit" };
      }

      await waitForStability();

      const filled = await fillVisibleFields({ stage: stage || lastStage });
      if (filled > 0) log.info(`Filled ${filled} field(s)`);

      // Click a navigation button if present.
      const nextBtn =
        findButtonLike(["save and continue"]) ||
        findButtonLike(["next", "continue", "review", "proceed"]);

      if (nextBtn) {
        clickElement(nextBtn);
        await waitForTransition({ prevStage: stage || lastStage });
        continue;
      }

      // If we can’t find navigation and we’re not at submit, just wait a bit
      // for Workday to render the next section.
      await delay(1500);
    }

    return { success: false, error: "workday_flow_incomplete" };
  }

  function isInApplicationFlow() {
    // Workday applications almost always render the progress bar.
    return !!document.querySelector('[data-automation-id="progressBar"]');
  }

  function getWorkdayStageLabel() {
    try {
      const progressBar = document.querySelector(
        '[data-automation-id="progressBar"]'
      );
      const curStep = progressBar?.querySelector(
        '[data-automation-id="progressBarActiveStep"]'
      );
      const label = curStep?.children?.[2]?.textContent || null;
      return label ? String(label).trim().slice(0, 120) : null;
    } catch {
      return null;
    }
  }

  async function fillVisibleFields(ctx) {
    let filled = 0;

    // 1) Resume upload (Workday often requires this early)
    try {
      if (_resumeAttachment?.base64 && globalThis.JobPilotResumeFile) {
        const input =
          findWorkdayResumeInput() ||
          globalThis.JobPilotResumeFile.findResumeFileInput(
            document.documentElement,
            typeof globalThis.getFieldLabel === "function"
              ? globalThis.getFieldLabel
              : null
          );
        if (input && (!input.files || input.files.length === 0)) {
          const ok = globalThis.JobPilotResumeFile.setFileInputFromBase64(
            input,
            _resumeAttachment.base64,
            _resumeAttachment.fileName || "resume.pdf"
          );
          if (ok) {
            filled++;
            await delay(600);
          }
        }
      }
    } catch (e) {
      log.warn("Resume upload failed:", e?.message || String(e));
    }

    // 1b) Workday stable IDs/names (often present even when data-automation-* is null)
    try {
      filled += fillByWorkdayIdName(_resumeData);
    } catch (e) {
      log.warn("fillByWorkdayIdName failed:", e?.message || String(e));
    }

    // 1c) Stage-aware helpers (conservative defaults)
    try {
      filled += fillWorkdayRadiosAndCheckboxes({
        stage: ctx?.stage || null,
      });
    } catch (e) {
      log.warn("fillWorkdayRadiosAndCheckboxes failed:", e?.message || String(e));
    }

    // 1d) Workday dropdown/listbox selection (conservative)
    try {
      filled += await fillWorkdayListboxDropdowns(_resumeData);
    } catch (e) {
      log.warn("fillWorkdayListboxDropdowns failed:", e?.message || String(e));
    }

    // 1e) Workday multi-entry sections (experience/education) — best effort
    try {
      filled += await fillWorkdayExperienceEntries(_resumeData);
    } catch (e) {
      log.warn("fillWorkdayExperienceEntries failed:", e?.message || String(e));
    }
    try {
      filled += await fillWorkdayEducationEntries(_resumeData);
    } catch (e) {
      log.warn("fillWorkdayEducationEntries failed:", e?.message || String(e));
    }

    // 2) Workday-specific basics via stable automation attributes
    const basic = buildBasicAutofillMap(_resumeData);
    for (const [needle, value] of Object.entries(basic)) {
      if (!value) continue;
      const input = queryByAutomationNeedle(needle, "input, textarea");
      if (input && !String(input.value || "").trim()) {
        setNativeValueSafe(input, value);
        filled++;
        await delay(120);
      }
    }

    // 3) Generic fallback: run shared filler on any plain inputs/selects
    try {
      if (typeof fillAllFields === "function") {
        filled += fillAllFields(document.documentElement, _resumeData);
      }
    } catch (e) {
      log.warn("fillAllFields failed:", e?.message || String(e));
    }

    // 4) Nudge after fill (React-controlled inputs / validations)
    try {
      if (typeof nudgeFormAfterFill === "function") {
        nudgeFormAfterFill(document.documentElement, globalThis.PanelKernel);
      }
    } catch {
      /* ignore */
    }

    return filled;
  }

  async function fillWorkdayExperienceEntries(resumeData) {
    const entries = resumeData?.experience?.entries || [];
    if (!Array.isArray(entries) || entries.length === 0) return 0;

    // Find an “Add Work Experience” style button
    const addBtn =
      queryButtonByText(["add", "work experience"]) ||
      document.querySelector('[data-automation-id*="add-button" i]') ||
      null;
    if (!addBtn || !isVisible(addBtn) || isDisabled(addBtn)) return 0;

    // Fill at most 2 entries in first pass for safety
    const max = Math.min(entries.length, 2);
    let filled = 0;

    for (let i = 0; i < max; i++) {
      clickElement(addBtn);
      await delay(1200);

      const e = entries[i] || {};

      filled += fillIfEmpty(queryByAutomationNeedle("jobTitle", "input"), e.title);
      filled += fillIfEmpty(queryByAutomationNeedle("companyName", "input"), e.company);

      // Dates: some Workday layouts use dateSectionMonth/year needles (like Autofill-Jobs)
      if (e.startMonth) {
        filled += fillIfEmpty(
          queryByAutomationNeedle("startDate-dateSectionMonth", "input"),
          String(e.startMonth)
        );
      }
      if (e.startYear) {
        filled += fillIfEmpty(
          queryByAutomationNeedle("startDate-dateSectionYear", "input"),
          String(e.startYear)
        );
      }
      if (!e.isCurrent && e.endMonth) {
        filled += fillIfEmpty(
          queryByAutomationNeedle("endDate-dateSectionMonth", "input"),
          String(e.endMonth)
        );
      }
      if (!e.isCurrent && e.endYear) {
        filled += fillIfEmpty(
          queryByAutomationNeedle("endDate-dateSectionYear", "input"),
          String(e.endYear)
        );
      }
      if (e.description) {
        filled += fillIfEmpty(
          queryByAutomationNeedle("roleDescription", "textarea"),
          String(e.description)
        );
      }

      await delay(500);
      if (typeof nudgeFormAfterFill === "function") {
        try {
          nudgeFormAfterFill(document.documentElement, globalThis.PanelKernel);
        } catch {}
      }
      await delay(500);
    }

    return filled;
  }

  async function fillWorkdayEducationEntries(resumeData) {
    const entries = resumeData?.education || resumeData?.educationEntries || [];
    // Canonical: resumeData.educationEntries is array; allow fallback for earlier shapes
    const edus = Array.isArray(entries) ? entries : [];
    if (edus.length === 0) return 0;

    // Look for Add Education button
    const addBtn = queryButtonByText(["add", "education"]) || null;
    if (!addBtn || !isVisible(addBtn) || isDisabled(addBtn)) return 0;

    const max = Math.min(edus.length, 1);
    let filled = 0;

    for (let i = 0; i < max; i++) {
      clickElement(addBtn);
      await delay(1200);
      const e = edus[i] || {};

      filled += fillIfEmpty(queryByAutomationNeedle("schoolName", "input"), e.school || e);
      filled += fillIfEmpty(queryByAutomationNeedle("degree", "input"), e.degree);
      filled += fillIfEmpty(queryByAutomationNeedle("fieldOfStudy", "input"), e.fieldOfStudy);
      if (e.gpa) filled += fillIfEmpty(queryByAutomationNeedle("gradeAverage", "input"), e.gpa);
    }

    return filled;
  }

  function fillIfEmpty(el, value) {
    if (!el || !value) return 0;
    if (!isVisible(el) || isDisabled(el)) return 0;
    if (String(el.value || "").trim()) return 0;
    setNativeValueSafe(el, value);
    return 1;
  }

  function queryButtonByText(parts) {
    const needles = (parts || []).map((p) => normalizeText(p));
    const btns = Array.from(document.querySelectorAll("button, [role='button'], a"));
    for (const b of btns) {
      if (!isVisible(b) || isDisabled(b)) continue;
      const t = normalizeText(b.textContent || b.getAttribute("aria-label") || "");
      if (!t) continue;
      let ok = true;
      for (const n of needles) {
        if (!n) continue;
        if (!t.includes(n)) {
          ok = false;
          break;
        }
      }
      if (ok) return b;
    }
    return null;
  }

  async function fillWorkdayListboxDropdowns(resumeData) {
    // Workday commonly renders dropdown triggers as <button> with aria-haspopup="listbox"
    // and a listbox as <ul role="listbox"> after clicking.
    const triggers = Array.from(
      document.querySelectorAll(
        'button[aria-haspopup="listbox"], [role="combobox"][aria-haspopup="listbox"]'
      )
    ).filter((el) => isVisible(el) && !isDisabled(el));

    if (triggers.length === 0) return 0;

    // Very conservative: only attempt dropdowns we can map to known values.
    // If we don’t know what to select, skip.
    const desiredByLabel = (label) => {
      const t = normalizeText(label);
      if (!t) return null;

      // If user has explicit demographic values, those may be in resumeData;
      // otherwise, we prefer not to say.
      const preferNot = "prefer not to say";

      if (t.includes("gender")) return resumeData?.gender || preferNot;
      if (t.includes("race") || t.includes("ethnicity"))
        return resumeData?.race || preferNot;
      if (t.includes("veteran")) return resumeData?.veteranStatus || preferNot;
      if (t.includes("disability")) return resumeData?.disabilityStatus || preferNot;

      // Location selectors (country/state) are too risky without structured data.
      return null;
    };

    let filled = 0;

    for (const trig of triggers) {
      const container =
        trig.closest("[data-automation-id], [class*='formField'], [class*='field']") ||
        trig.parentElement;
      const label =
        container?.querySelector("label, legend, [data-automation-label], [class*='label']")?.textContent ||
        trig.getAttribute("aria-label") ||
        "";

      const desired = desiredByLabel(label);
      if (!desired) continue;

      // Skip if trigger already has a chosen value
      const currentText = normalizeText(trig.textContent || "");
      if (currentText && !currentText.includes("select") && !currentText.includes("choose")) {
        continue;
      }

      clickElement(trig);
      await delay(650);

      const listbox =
        document.querySelector('ul[role="listbox"]') ||
        document.querySelector('[role="listbox"]');
      if (!listbox) continue;

      const options = Array.from(
        listbox.querySelectorAll('[role="option"], li, li div')
      ).filter((o) => isVisible(o));
      if (options.length === 0) continue;

      const desiredLower = normalizeText(desired);
      let picked = null;
      for (const opt of options) {
        const tx = normalizeText(opt.textContent || opt.getAttribute("aria-label") || "");
        if (!tx) continue;
        if (tx === desiredLower || tx.includes(desiredLower) || desiredLower.includes(tx)) {
          picked = opt;
          break;
        }
      }

      if (!picked) {
        // Prefer not to say might be slightly different text
        if (desiredLower.includes("prefer")) {
          picked =
            options.find((o) =>
              normalizeText(o.textContent || "").includes("prefer not")
            ) || null;
        }
      }

      if (picked) {
        clickElement(picked);
        filled++;
        await delay(450);
      } else {
        // Close listbox to avoid blocking the runner
        try {
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
          );
        } catch {}
        await delay(200);
      }
    }

    return filled;
  }

  function fillByWorkdayIdName(resumeData) {
    const fullName = String(resumeData?.name || "").trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] || "";
    const lastName = parts.length > 1 ? parts[parts.length - 1] : "";

    const pairs = [
      // Legal name
      ["name--legalName--firstName", firstName],
      ["name--legalName--lastName", lastName],
      // Workday sometimes uses name attributes instead
      ["legalName--firstName", firstName],
      ["legalName--lastName", lastName],

      // Phone
      ["phoneNumber--phoneNumber", resumeData?.phone ? String(resumeData.phone) : ""],
      ["phoneNumber", resumeData?.phone ? String(resumeData.phone) : ""],

      // Location fields (we only have a single string today; fill city-like fields)
      ["address--city", resumeData?.location ? String(resumeData.location) : ""],
      ["city", resumeData?.location ? String(resumeData.location) : ""],
      // Postal code + address line are left blank unless user has structured data later
    ];

    let filled = 0;
    for (const [needle, value] of pairs) {
      if (!value) continue;
      const el =
        document.getElementById(needle) ||
        document.querySelector(`input[name="${cssEscape(needle)}"], textarea[name="${cssEscape(needle)}"]`);
      if (!el) continue;
      if (!isVisible(el)) continue;
      if (String(el.value || "").trim()) continue;
      // Avoid country code inputs
      if (String(el.id || "").toLowerCase().includes("countryphonecode")) continue;
      if (String(el.name || "").toLowerCase().includes("countryphonecode")) continue;
      setNativeValueSafe(el, value);
      filled++;
    }
    return filled;
  }

  function fillWorkdayRadiosAndCheckboxes(ctx) {
    const root = document.documentElement;

    // Group radios by name
    const radios = Array.from(root.querySelectorAll("input[type='radio']"));
    const groups = new Map();
    for (const r of radios) {
      const name = r.getAttribute("name");
      if (!name) continue;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(r);
    }

    let filled = 0;

    for (const [name, group] of groups.entries()) {
      if (group.some((r) => r.checked)) continue;

      // Try to understand question text
      const any = group[0];
      const question = normalizeText(getNearbyQuestionText(any));

      // Conservative defaults:
      // - previous worker / previously employed => No
      // - otherwise: if options have Yes/No labels pick "No" if present else first visible
      let pick = null;
      if (question.includes("previous") && question.includes("work")) {
        pick = pickRadioByLabel(group, "no") || pickRadioByLabel(group, "false");
      }
      if (!pick) {
        pick = pickRadioByLabel(group, "no") || pickRadioByLabel(group, "yes");
      }
      if (!pick) {
        pick = group.find((r) => isVisible(getRadioClickTarget(r)) && !isDisabled(r)) || null;
      }

      if (pick) {
        const target = getRadioClickTarget(pick);
        clickElement(target);
        try {
          pick.dispatchEvent(new Event("change", { bubbles: true }));
          pick.dispatchEvent(new Event("input", { bubbles: true }));
        } catch {}
        filled++;
      }
    }

    // Avoid clicking marketing / sms opt-in checkboxes (like phone-sms-opt-in)
    const cbs = Array.from(root.querySelectorAll("input[type='checkbox']"));
    for (const cb of cbs) {
      if (!isVisible(cb) || isDisabled(cb)) continue;
      if (cb.checked) continue;
      const aid = normalizeText(cb.getAttribute("data-automation-id") || "");
      const label = normalizeText(getFieldLikeLabel(cb));
      if (aid.includes("sms-opt-in") || label.includes("sms")) continue;
      // Only auto-check if the label suggests acknowledgement/consent/terms and it is required-ish.
      if (
        label.includes("agree") ||
        label.includes("acknowledge") ||
        label.includes("consent") ||
        label.includes("terms")
      ) {
        clickElement(cb);
        try {
          cb.dispatchEvent(new Event("change", { bubbles: true }));
        } catch {}
        filled++;
      }
    }

    return filled;
  }

  function pickRadioByLabel(group, needle) {
    const n = normalizeText(needle);
    for (const r of group) {
      const t = normalizeText(getRadioLabel(r));
      if (t === n || t.startsWith(n) || t.includes(n)) return r;
    }
    return null;
  }

  function getRadioLabel(radio) {
    try {
      const wrap = radio.closest("label");
      if (wrap) return wrap.textContent || "";
      const id = radio.id;
      if (id) {
        const lbl = radio.getRootNode()?.querySelector?.(`label[for="${cssEscape(id)}"]`);
        if (lbl) return lbl.textContent || "";
      }
    } catch {}
    return radio.value || "";
  }

  function getRadioClickTarget(radio) {
    try {
      const id = radio.id;
      if (id) {
        const lbl = radio.parentElement?.querySelector?.(`label[for="${cssEscape(id)}"]`);
        if (lbl) return lbl;
        const rootLbl = radio.getRootNode()?.querySelector?.(`label[for="${cssEscape(id)}"]`);
        if (rootLbl) return rootLbl;
      }
      const wrap = radio.closest("label");
      if (wrap) return wrap;
      return radio;
    } catch {
      return radio;
    }
  }

  function getNearbyQuestionText(el) {
    try {
      // Look for a nearby legend/label/heading
      const fieldset = el.closest("fieldset");
      if (fieldset) {
        const legend = fieldset.querySelector("legend");
        if (legend && isVisible(legend)) return legend.textContent || "";
        const h = fieldset.querySelector("h1, h2, h3, h4, [class*='label']");
        if (h && isVisible(h)) return h.textContent || "";
      }
      const container = el.closest("[data-automation-id], [class*='field'], [class*='formField']");
      if (container) {
        const lbl = container.querySelector("label, legend, [class*='label'], [data-automation-label]");
        if (lbl && isVisible(lbl)) return lbl.textContent || lbl.getAttribute("data-automation-label") || "";
      }
    } catch {}
    return "";
  }

  function getFieldLikeLabel(el) {
    try {
      if (typeof globalThis.getFieldLabel === "function") return globalThis.getFieldLabel(el) || "";
    } catch {}
    return el.getAttribute("aria-label") || el.getAttribute("name") || el.id || "";
  }

  async function waitForStability() {
    try {
      if (globalThis.PanelKernel?.waitForMutationStability) {
        await globalThis.PanelKernel.waitForMutationStability(
          document.documentElement,
          220,
          4500
        );
        return;
      }
    } catch {
      /* ignore */
    }
    await delay(700);
  }

  async function waitForTransition({ prevStage }) {
    const prev = prevStage || null;
    const deadline = Date.now() + 12000;
    await delay(900);
    while (Date.now() < deadline) {
      await waitForStability();
      const now = getWorkdayStageLabel();
      if (now && prev && now !== prev) return;
      // If stage unavailable, stop once UI mutated and a nav button is present again
      if (findButtonLike(["save and continue"]) || findButtonLike(["next", "continue"])) {
        await delay(600);
        return;
      }
      await delay(450);
    }
  }

  function cssEscape(s) {
    try {
      return CSS && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/"/g, '\\"');
    } catch {
      return String(s).replace(/"/g, '\\"');
    }
  }

  function buildBasicAutofillMap(resumeData) {
    const name = resumeData?.name ? String(resumeData.name).trim() : "";
    const nameParts = name.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

    return {
      firstName: firstName,
      lastName: lastName,
      email: resumeData?.email ? String(resumeData.email) : "",
      phoneNumber: resumeData?.phone ? String(resumeData.phone) : "",
      city: resumeData?.location ? String(resumeData.location) : "",
      linkedin: resumeData?.linkedinUrl ? String(resumeData.linkedinUrl) : "",
    };
  }

  function findWorkdayResumeInput() {
    // Common Workday automation-id for file upload
    return (
      document.querySelector(
        'input[type="file"][data-automation-id*="file-upload" i]'
      ) || document.querySelector('input[type="file"]')
    );
  }

  function queryByAutomationNeedle(needle, selector) {
    const n = String(needle || "").toLowerCase();
    const els = document.querySelectorAll(selector);
    for (const el of els) {
      try {
        const attrs = [
          el.id,
          el.name,
          el.getAttribute("data-automation-id"),
          el.getAttribute("data-automation-label"),
          el.getAttribute("aria-label"),
        ]
          .filter(Boolean)
          .map((x) => String(x).toLowerCase());
        if (attrs.some((a) => a.includes(n) && !a.includes("phonecode"))) {
          return el;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  function findSubmitLikeButton() {
    const candidates = Array.from(
      document.querySelectorAll("button, [role='button'], a")
    );
    for (const el of candidates) {
      if (!isVisible(el) || isDisabled(el)) continue;
      const t = normalizeText(el.textContent || el.getAttribute("aria-label"));
      const aid = normalizeText(el.getAttribute("data-automation-id"));
      if (t.includes("submit") || aid.includes("submit")) return el;
      if (t.includes("submit application")) return el;
    }
    return null;
  }

  function findButtonLike(labels) {
    const needles = (labels || []).map((s) => normalizeText(s));
    const candidates = Array.from(
      document.querySelectorAll("button, [role='button'], a")
    );
    for (const el of candidates) {
      if (!isVisible(el) || isDisabled(el)) continue;
      const t = normalizeText(el.textContent || "");
      const aria = normalizeText(el.getAttribute("aria-label") || "");
      const aid = normalizeText(el.getAttribute("data-automation-id") || "");

      for (const n of needles) {
        if (!n) continue;
        if (t === n || t.includes(n)) return el;
        if (aria === n || aria.includes(n)) return el;
        if (aid === n || aid.includes(n)) return el;
      }
    }
    return null;
  }

  function setNativeValueSafe(el, value) {
    if (typeof setNativeValue === "function") {
      setNativeValue(el, value);
      return;
    }
    try {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch {
      /* ignore */
    }
  }

  function normalizeText(str) {
    return String(str || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isVisible(el) {
    if (!el) return false;
    try {
      const style = (el.ownerDocument?.defaultView || window).getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (Number(style.opacity) === 0) return false;
    } catch {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isDisabled(el) {
    if (!el) return true;
    if (el.disabled) return true;
    if (el.getAttribute && el.getAttribute("aria-disabled") === "true") return true;
    return false;
  }

  function clickElement(el) {
    if (!el) return;
    try {
      el.scrollIntoView({ block: "center", behavior: "instant" });
    } catch {}
    try {
      el.click();
    } catch {
      try {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      } catch {
        /* ignore */
      }
    }
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      const timer = setTimeout(() => reject(new Error("Workday flow timed out")), ms);
      promise
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
}

