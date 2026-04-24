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
  let _jobContext = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action !== "applyToJob") return;

    _resumeData = message.resumeData || null;
    _resumeAttachment = message.resumeAttachment || null;
    _jobContext = message.jobContext || null;

    const mode = message.mode || "guided";

    const runner =
      mode === "oneShot"
        ? runOneShotWorkdayFill()
        : runGuidedWorkdayFlow();

    withTimeout(runner, TIMEOUT_MS)
      .then((result) => sendResponse(result))
      .catch((err) =>
        sendResponse({ success: false, error: err?.message || String(err) })
      );

    return true;
  });

  async function runOneShotWorkdayFill() {
    // Do not navigate between stages; just fill what’s on-screen right now.
    log.info("One-shot Workday fill", { url: location.href });
    await ensurePageLoaded();
    await delay(900);
    await waitForStability();
    const filled = await fillVisibleFields({ stage: getWorkdayStageLabel() });
    return { success: true, message: "one_shot_filled", filled };
  }

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

    // 3b) AI fallback for unknown long-answer questions (never overwrites).
    try {
      if (typeof fillLongAnswerWithAI === "function") {
        const candidates = Array.from(
          document.querySelectorAll("textarea, input[aria-multiline='true']")
        );
        for (const el of candidates) {
          if (!el || !isVisible(el) || isDisabled(el)) continue;
          if (String(el.value || "").trim()) continue;
          const label = getFieldLikeLabel(el);
          const did = await fillLongAnswerWithAI(
            el,
            label,
            _resumeData,
            _jobContext,
            {
              onSkip: (d) =>
                log.info("AI skip", d?.reason || "", (d?.label || "").slice(0, 80)),
            }
          );
          if (did) {
            filled++;
            await delay(150);
          }
        }
      }
    } catch (e) {
      log.warn("AI long-answer fill failed:", e?.message || String(e));
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

    // Find an “Add Work Experience” style button (Workday varies widely).
    const addBtn =
      findWorkdayAddButton(["work experience", "experience"]) ||
      queryButtonByText(["add", "work experience"]) ||
      queryButtonByText(["add", "experience"]) ||
      document.querySelector(
        'button[aria-label*="add work experience" i], button[aria-label*="add experience" i]'
      ) ||
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

      // Prefer automation needles, but fall back to label-based targeting.
      // Workday often repeats the same automation-id per row; use i-th match (TESTREPO style).
      const titleEl =
        queryAllByWorkdayWrapperNeedle("jobTitle", "input")[i] ||
        queryAllByAutomationNeedle("jobTitle", "input")[i] ||
        queryAllByWorkdayWrapperNeedle("jobTitle", "input").slice(-1)[0] ||
        queryAllByAutomationNeedle("jobTitle", "input").slice(-1)[0] ||
        queryByAutomationNeedle("jobTitle", "input");
      const companyEl =
        queryAllByWorkdayWrapperNeedle("companyName", "input")[i] ||
        queryAllByAutomationNeedle("companyName", "input")[i] ||
        queryAllByWorkdayWrapperNeedle("companyName", "input").slice(-1)[0] ||
        queryAllByAutomationNeedle("companyName", "input").slice(-1)[0] ||
        queryByAutomationNeedle("companyName", "input");

      filled += fillIfEmpty(titleEl, e.title);
      filled += fillIfEmpty(companyEl, e.company);

      // Workday "I currently work here" checkbox is often required to unlock end date fields.
      if (e.isCurrent) {
        const curCb =
          queryAllByWorkdayWrapperNeedle("currentlyWorkHere", "input[type='checkbox']")[i] ||
          queryAllByWorkdayWrapperNeedle("current", "input[type='checkbox']")[i] ||
          queryAllByAutomationNeedle("currentlyWorkHere", "input[type='checkbox']")[i] ||
          queryByAutomationNeedle("currentlyWorkHere", "input[type='checkbox']") ||
          null;
        if (curCb && !curCb.checked) {
          try {
            clickElement(curCb);
            curCb.dispatchEvent(new Event("change", { bubbles: true }));
          } catch {
            /* ignore */
          }
        }
      }

      filled += fillWorkdayEntryByLabels({
        title: e.title,
        company: e.company,
        description: e.description,
        startMonth: e.startMonth,
        startYear: e.startYear,
        endMonth: e.endMonth,
        endYear: e.endYear,
        isCurrent: e.isCurrent,
      });

      // Dates: some Workday layouts use dateSectionMonth/year needles (like Autofill-Jobs)
      if (e.startMonth) {
        filled += fillIfEmpty(
          queryAllByWorkdayWrapperNeedle("startDate-dateSectionMonth", "input")[i] ||
            queryAllByAutomationNeedle("startDate-dateSectionMonth", "input")[i] ||
            queryAllByWorkdayWrapperNeedle("startDate-dateSectionMonth", "input").slice(-1)[0] ||
            queryAllByAutomationNeedle("startDate-dateSectionMonth", "input").slice(-1)[0] ||
            queryByAutomationNeedle("startDate-dateSectionMonth", "input"),
          String(e.startMonth)
        );
      }
      if (e.startYear) {
        filled += fillIfEmpty(
          queryAllByWorkdayWrapperNeedle("startDate-dateSectionYear", "input")[i] ||
            queryAllByAutomationNeedle("startDate-dateSectionYear", "input")[i] ||
            queryAllByWorkdayWrapperNeedle("startDate-dateSectionYear", "input").slice(-1)[0] ||
            queryAllByAutomationNeedle("startDate-dateSectionYear", "input").slice(-1)[0] ||
            queryByAutomationNeedle("startDate-dateSectionYear", "input"),
          String(e.startYear)
        );
      }
      if (!e.isCurrent && e.endMonth) {
        filled += fillIfEmpty(
          queryAllByWorkdayWrapperNeedle("endDate-dateSectionMonth", "input")[i] ||
            queryAllByAutomationNeedle("endDate-dateSectionMonth", "input")[i] ||
            queryAllByWorkdayWrapperNeedle("endDate-dateSectionMonth", "input").slice(-1)[0] ||
            queryAllByAutomationNeedle("endDate-dateSectionMonth", "input").slice(-1)[0] ||
            queryByAutomationNeedle("endDate-dateSectionMonth", "input"),
          String(e.endMonth)
        );
      }
      if (!e.isCurrent && e.endYear) {
        filled += fillIfEmpty(
          queryAllByWorkdayWrapperNeedle("endDate-dateSectionYear", "input")[i] ||
            queryAllByAutomationNeedle("endDate-dateSectionYear", "input")[i] ||
            queryAllByWorkdayWrapperNeedle("endDate-dateSectionYear", "input").slice(-1)[0] ||
            queryAllByAutomationNeedle("endDate-dateSectionYear", "input").slice(-1)[0] ||
            queryByAutomationNeedle("endDate-dateSectionYear", "input"),
          String(e.endYear)
        );
      }
      if (e.description) {
        filled += fillIfEmpty(
          queryAllByWorkdayWrapperNeedle("roleDescription", "textarea")[i] ||
            queryAllByAutomationNeedle("roleDescription", "textarea")[i] ||
            queryAllByWorkdayWrapperNeedle("roleDescription", "textarea").slice(-1)[0] ||
            queryAllByAutomationNeedle("roleDescription", "textarea").slice(-1)[0] ||
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
    const addBtn =
      findWorkdayAddButton(["education"]) ||
      queryButtonByText(["add", "education"]) ||
      document.querySelector('button[aria-label*="add education" i]') ||
      document.querySelector('[data-automation-id*="add-button" i]') ||
      null;
    if (!addBtn || !isVisible(addBtn) || isDisabled(addBtn)) return 0;

    const max = Math.min(edus.length, 1);
    let filled = 0;

    for (let i = 0; i < max; i++) {
      clickElement(addBtn);
      await delay(1200);
      const e = edus[i] || {};

      const schoolEl =
        queryAllByWorkdayWrapperNeedle("schoolName", "input")[i] ||
        queryAllByAutomationNeedle("schoolName", "input")[i] ||
        queryAllByWorkdayWrapperNeedle("schoolName", "input").slice(-1)[0] ||
        queryAllByAutomationNeedle("schoolName", "input").slice(-1)[0] ||
        queryByAutomationNeedle("schoolName", "input");
      const degreeEl =
        queryAllByWorkdayWrapperNeedle("degree", "input")[i] ||
        queryAllByAutomationNeedle("degree", "input")[i] ||
        queryAllByWorkdayWrapperNeedle("degree", "input").slice(-1)[0] ||
        queryAllByAutomationNeedle("degree", "input").slice(-1)[0] ||
        queryByAutomationNeedle("degree", "input");
      const fieldEl =
        queryAllByWorkdayWrapperNeedle("fieldOfStudy", "input")[i] ||
        queryAllByAutomationNeedle("fieldOfStudy", "input")[i] ||
        queryAllByWorkdayWrapperNeedle("fieldOfStudy", "input").slice(-1)[0] ||
        queryAllByAutomationNeedle("fieldOfStudy", "input").slice(-1)[0] ||
        queryByAutomationNeedle("fieldOfStudy", "input");
      const gpaEl =
        queryAllByWorkdayWrapperNeedle("gradeAverage", "input")[i] ||
        queryAllByAutomationNeedle("gradeAverage", "input")[i] ||
        queryAllByWorkdayWrapperNeedle("gradeAverage", "input").slice(-1)[0] ||
        queryAllByAutomationNeedle("gradeAverage", "input").slice(-1)[0] ||
        queryByAutomationNeedle("gradeAverage", "input");

      filled += fillIfEmpty(schoolEl, e.school || e);
      filled += fillIfEmpty(degreeEl, e.degree);
      filled += fillIfEmpty(fieldEl, e.fieldOfStudy);
      if (e.gpa) filled += fillIfEmpty(gpaEl, e.gpa);

      filled += fillWorkdayEducationByLabels({
        school: e.school,
        degree: e.degree,
        fieldOfStudy: e.fieldOfStudy,
        gpa: e.gpa,
        startMonth: e.startMonth,
        startYear: e.startYear,
        endMonth: e.endMonth,
        endYear: e.endYear,
      });
    }

    return filled;
  }

  function queryAllByAutomationNeedle(needle, selector) {
    const n = String(needle || "").toLowerCase();
    const res = [];
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
          res.push(el);
        }
      } catch {
        /* ignore */
      }
    }
    return res;
  }

  /**
   * Workday commonly puts the stable identifier on a wrapper like:
   *   <div data-automation-id="formField-roleDescription"> ... <textarea id="workExperience-31--roleDescription">
   * So we query wrappers and then pull the inner input/textarea.
   */
  function queryAllByWorkdayWrapperNeedle(needle, innerSelector) {
    try {
      const n = String(needle || "").toLowerCase();
      const selector =
        `[data-automation-id*="formfield-${n}" i],` +
        `[data-automation-id*="formField-${n}" i],` +
        `[data-automation-id*="${n}" i]`;
      const wrappers = Array.from(document.querySelectorAll(selector)).filter((w) =>
        isVisible(w)
      );
      const out = [];
      for (const w of wrappers) {
        const el = w.querySelector(innerSelector);
        if (el && isVisible(el) && !isDisabled(el)) out.push(el);
      }
      return out;
    } catch {
      return [];
    }
  }

  function findWorkdayAddButton(sectionKeywords) {
    try {
      const keys = (sectionKeywords || [])
        .map((s) => normalizeText(s))
        .filter(Boolean);
      if (keys.length === 0) return null;

      const buttons = Array.from(
        document.querySelectorAll("button, [role='button'], a")
      ).filter((b) => isVisible(b) && !isDisabled(b));

      const nearbySectionText = (b) => {
        try {
          // Walk up a few ancestors and also check previous siblings for headings.
          let el = b;
          for (let i = 0; el && i < 8; i++, el = el.parentElement) {
            if (!el) break;

            const heading =
              el.querySelector?.("h1,h2,h3,h4,legend,[role='heading'],[data-automation-label]") ||
              null;
            const ht = normalizeText(
              heading?.textContent ||
                heading?.getAttribute?.("data-automation-label") ||
                ""
            );
            if (ht) return ht;

            // Previous siblings often contain "Work Experience" heading in Workday.
            let sib = el.previousElementSibling;
            for (let j = 0; sib && j < 6; j++, sib = sib.previousElementSibling) {
              const st = normalizeText(sib.textContent || "");
              if (st && st.length <= 120) return st;
            }
          }
        } catch {
          /* ignore */
        }
        return "";
      };

      const scoreBtn = (b) => {
        const t = normalizeText(b.textContent || "");
        const aria = normalizeText(b.getAttribute("aria-label") || "");
        const aid = normalizeText(b.getAttribute("data-automation-id") || "");
        const combined = `${t} ${aria} ${aid}`.trim();
        if (!combined.includes("add")) return -1;

        // Strong signal: aria-label contains the section keyword.
        if (keys.some((k) => aria.includes(k))) return 100;
        if (keys.some((k) => t.includes(k))) return 80;

        // Medium signal: nearby container heading contains keyword.
        const container =
          b.closest("section, fieldset, [data-automation-id], [class*='section'], [class*='panel']") ||
          b.parentElement;
        const blob = normalizeText(
          container?.querySelector?.("h1,h2,h3,h4,legend,label")?.textContent ||
            container?.textContent ||
            ""
        );
        if (keys.some((k) => blob.includes(k))) return 60;

        // Workday often renders just "Add" — use nearby heading/sibling text.
        const near = nearbySectionText(b);
        if (near && keys.some((k) => near.includes(k))) return 70;

        return 10;
      };

      let best = null;
      let bestScore = 0;
      for (const b of buttons) {
        const s = scoreBtn(b);
        if (s > bestScore) {
          bestScore = s;
          best = b;
        }
      }
      return bestScore >= 50 ? best : null;
    } catch {
      return null;
    }
  }

  function fillWorkdayEntryByLabels(e) {
    try {
      if (!e || typeof e !== "object") return 0;
      const root = document.documentElement;
      const fields = Array.from(root.querySelectorAll("input, textarea")).filter(
        (el) =>
          isVisible(el) &&
          !isDisabled(el) &&
          !String(el.value || "").trim() &&
          el.type !== "hidden" &&
          el.type !== "file"
      );

      let filled = 0;

      const labelOf = (el) => {
        try {
          if (typeof globalThis.getFieldLabel === "function") return normalizeText(globalThis.getFieldLabel(el));
        } catch {}
        return normalizeText(el.getAttribute("aria-label") || el.getAttribute("name") || el.id || "");
      };

      for (const el of fields) {
        const label = labelOf(el);
        if (!label) continue;

        if (e.title && (label.includes("job title") || (label.includes("title") && !label.includes("subtitle")))) {
          setNativeValueSafe(el, String(e.title));
          filled++;
          continue;
        }
        if (e.company && (label.includes("company") || label.includes("employer") || label.includes("organization"))) {
          setNativeValueSafe(el, String(e.company));
          filled++;
          continue;
        }
        if (
          e.description &&
          (label.includes("description") || label.includes("responsibil") || label.includes("summary") || label.includes("role"))
        ) {
          setNativeValueSafe(el, String(e.description));
          filled++;
          continue;
        }

        // Date fields: keep very conservative; only fill if label clearly says month/year.
        if (e.startMonth && label.includes("start") && label.includes("month")) {
          setNativeValueSafe(el, String(e.startMonth));
          filled++;
          continue;
        }
        if (e.startYear && label.includes("start") && label.includes("year")) {
          setNativeValueSafe(el, String(e.startYear));
          filled++;
          continue;
        }
        if (!e.isCurrent && e.endMonth && label.includes("end") && label.includes("month")) {
          setNativeValueSafe(el, String(e.endMonth));
          filled++;
          continue;
        }
        if (!e.isCurrent && e.endYear && label.includes("end") && label.includes("year")) {
          setNativeValueSafe(el, String(e.endYear));
          filled++;
          continue;
        }
      }

      return filled;
    } catch {
      return 0;
    }
  }

  function fillWorkdayEducationByLabels(ed) {
    try {
      if (!ed || typeof ed !== "object") return 0;
      const root = document.documentElement;
      const fields = Array.from(root.querySelectorAll("input, textarea")).filter(
        (el) =>
          isVisible(el) &&
          !isDisabled(el) &&
          !String(el.value || "").trim() &&
          el.type !== "hidden" &&
          el.type !== "file"
      );

      let filled = 0;

      const labelOf = (el) => {
        try {
          if (typeof globalThis.getFieldLabel === "function") return normalizeText(globalThis.getFieldLabel(el));
        } catch {}
        return normalizeText(el.getAttribute("aria-label") || el.getAttribute("name") || el.id || "");
      };

      for (const el of fields) {
        const label = labelOf(el);
        if (!label) continue;

        if (ed.school && (label.includes("school") || label.includes("university") || label.includes("institution"))) {
          setNativeValueSafe(el, String(ed.school));
          filled++;
          continue;
        }
        if (ed.degree && label.includes("degree")) {
          setNativeValueSafe(el, String(ed.degree));
          filled++;
          continue;
        }
        if (ed.fieldOfStudy && (label.includes("field") || label.includes("major") || label.includes("study"))) {
          setNativeValueSafe(el, String(ed.fieldOfStudy));
          filled++;
          continue;
        }
        if (ed.gpa && (label.includes("gpa") || label.includes("grade") || label.includes("cgpa"))) {
          setNativeValueSafe(el, String(ed.gpa));
          filled++;
          continue;
        }

        if (ed.startMonth && label.includes("start") && label.includes("month")) {
          setNativeValueSafe(el, String(ed.startMonth));
          filled++;
          continue;
        }
        if (ed.startYear && label.includes("start") && label.includes("year")) {
          setNativeValueSafe(el, String(ed.startYear));
          filled++;
          continue;
        }
        if (ed.endMonth && label.includes("end") && label.includes("month")) {
          setNativeValueSafe(el, String(ed.endMonth));
          filled++;
          continue;
        }
        if (ed.endYear && label.includes("end") && label.includes("year")) {
          setNativeValueSafe(el, String(ed.endYear));
          filled++;
          continue;
        }
      }

      return filled;
    } catch {
      return 0;
    }
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

      // Workday “Application Questions” (like your screenshot) — safe defaults.
      // Keep conservative: only answer when the question is clear.
      const yes = "yes";
      const no = "no";

      if (t.includes("relocat")) return resumeData?.workEligibility?.willingToRelocate || yes;
      if (t.includes("authorized to work") || (t.includes("authorized") && t.includes("country")))
        return resumeData?.workEligibility?.authorizedToWork || yes;
      if (t.includes("sponsor") || t.includes("visa") || t.includes("immigration"))
        return resumeData?.workEligibility?.needsSponsorship || no;
      if (t.includes("non-compete") || t.includes("noncompete") || t.includes("non solicitation"))
        return no;
      if (t.includes("government") && (t.includes("employee") || t.includes("employ")))
        return no;
      if (t.includes("workday system") || (t.includes("workday") && t.includes("current job")))
        return no;

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

