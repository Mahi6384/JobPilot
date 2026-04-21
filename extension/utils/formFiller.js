const FIELD_MAP = [
  {
    patterns: [/full\s*name/i, /your\s*name/i, /^name$/i, /candidate\s*name/i, /applicant\s*name/i, /first\s*(?:and|&)?\s*last\s*name/i],
    key: "name",
  },
  {
    patterns: [/e-?mail/i, /email\s*(?:address|id)/i],
    key: "email",
  },
  {
    patterns: [/phone|mobile|cell|telephone|contact\s*number/i],
    key: "phone",
  },
  {
    patterns: [
      /current\s*(?:ctc|salary|compensation)/i,
      /present\s*(?:ctc|salary)/i,
      /annual\s*(?:ctc|salary)/i,
      /salary\s*expectation/i,
      /desired\s*pay/i,
      /\bctc\b/i,
      /\blpa\b/i,
      /cost\s*to\s*company/i,
      /what\s+is\s+your.*(?:ctc|salary|package)/i,
      /how\s+much.*(?:earn|ctc|salary|make)/i,
      /monthly\s+or\s+annual\s+compensation/i,
      /\blacs?\s+per\s+annum\b/i,
      /\blakhs?\s+per\s+annum\b/i,
    ],
    key: "currentCtc",
  },
  {
    patterns: [
      /expected\s*(?:ctc|salary|compensation)/i,
      /desired\s*(?:salary|ctc)/i,
      /expected\s*lpa/i,
      /ask(?:ing|ed)?\s*(?:for|)\s*(?:ctc|salary|lpa)/i,
    ],
    key: "expectedSalary",
  },
  {
    patterns: [
      /\bexperience\b/i,
      /(?:total\s*)?(?:years?\s*of\s*)?(?:work\s*|professional\s*)?experience/i,
      /total\s*exp/i,
      /experience\s*in\s*years/i,
      /how\s+many\s+years.*experience/i,
      /years?\s+of\s+.*experience/i,
      /\bexperience\b.*\byears?\b/i,
      /\byears?\b.*\bexperience\b/i,
      /relevant\s+experience/i,
      /b2b.*experience/i,
      /experience\s+in\s+b2b/i,
    ],
    key: "yearsOfExperience",
  },
  {
    patterns: [/notice\s*period/i, /serving\s*notice/i, /how\s*soon\s*can\s*you\s*start/i],
    key: "noticePeriod",
    fallback: "30",
  },
  {
    patterns: [/current\s*(?:company|employer|organi[sz]ation)/i, /present\s*(?:company|employer)/i],
    key: "currentCompany",
  },
  {
    patterns: [/current\s*(?:designation|title|role|position)/i, /job\s*title/i, /present\s*(?:designation|title)/i, /headline/i],
    key: "currentTitle",
  },
  {
    patterns: [/\bcity\b/i, /\blocation\b/i, /current\s*(?:city|location)/i, /preferred\s*location/i, /address/i],
    key: "location",
  },
  {
    patterns: [/linkedin\s*(?:url|profile|link)?/i],
    key: "linkedinUrl",
  },
  {
    patterns: [/\bgender\b/i],
    key: "gender",
    fallback: "Male",
  },
  {
    patterns: [/\bgpa\b|cgpa|percentage/i, /score/i],
    key: "gpa",
    fallback: "3.5",
  },
  {
    patterns: [/portfolio|personal\s*(?:site|website|url)/i, /website/i],
    key: "portfolioUrl",
  },
];

function resolveValue(key, resumeData, fallback) {
  if (!resumeData) return fallback || null;

  const directMap = {
    name: resumeData.name,
    email: resumeData.email,
    phone: resumeData.phone,
    currentCtc: resumeData.currentCtc,
    expectedSalary: resumeData.expectedSalary,
    location: resumeData.location,
    linkedinUrl: resumeData.linkedinUrl,
    portfolioUrl: resumeData.portfolioUrl || resumeData.resumeUrl,
  };

  if (key in directMap) return directMap[key] || fallback || null;

  switch (key) {
    case "yearsOfExperience":
      return String(resumeData.experience?.years ?? fallback ?? "0");
    case "currentCompany":
      return resumeData.experience?.currentCompany || fallback || "";
    case "currentTitle":
      return resumeData.experience?.currentTitle || fallback || "";
    case "noticePeriod":
      return fallback || "30";
    case "gender":
      return fallback || "";
    case "gpa":
      return fallback || "";
    default:
      return fallback || "";
  }
}

function matchFieldToKey(label) {
  if (!label) return null;
  const text = label.toLowerCase().trim();
  for (const entry of FIELD_MAP) {
    for (const pattern of entry.patterns) {
      if (pattern.test(text)) return entry;
    }
  }
  return null;
}

/**
 * When label does not match FIELD_MAP, infer a reasonable text answer from wording.
 */
function inferGenericTextAnswer(label, resumeData) {
  if (!label || typeof label !== "string") return null;
  const t = label.toLowerCase().trim();
  const expYears =
    resumeData?.experience?.years != null && resumeData.experience.years !== ""
      ? String(resumeData.experience.years)
      : "2";
  const ctcRaw =
    (resumeData && (resumeData.currentCtc || resumeData.expectedSalary)) || "";
  const ctcDigits = String(ctcRaw).replace(/[^\d.]/g, "") || "8";

  if (/\bexperience\b/i.test(t)) {
    return { value: expYears, key: "fallback_experience" };
  }
  if (
    /ctc|lpa|\blacs?\b|\blac\b|\blakh|\blakhs?|salary|compensation|package|earn|income|pay\b|remuneration|per\s+annum/i.test(
      t
    )
  ) {
    return { value: ctcDigits, key: "fallback_salary" };
  }
  if (/notice\s*period|serving\s*notice|joining|availability/i.test(t)) {
    return { value: "30", key: "fallback_notice" };
  }
  if (/relocate|relocation|willing\s+to\s+(?:travel|relocate|move)|travel\s+to/i.test(t)) {
    return { value: "Yes", key: "fallback_yesno" };
  }
  return null;
}

function fillTextField(field, resumeData, hooks, labelOverride) {
  if (field.value && field.value.trim() !== "") return false;

  const label =
    (typeof labelOverride === "string" && labelOverride.trim() !== ""
      ? labelOverride.trim()
      : null) ||
    (typeof getFieldLabel === "function"
      ? getFieldLabel(field)
      : field.getAttribute("aria-label") ||
        field.getAttribute("placeholder") ||
        field.getAttribute("name") ||
        "");

  const mapped = matchFieldToKey(label);
  let value = null;
  let valueKey = null;
  let usedFallback = false;

  if (mapped) {
    value = resolveValue(mapped.key, resumeData, mapped.fallback);
    valueKey = mapped.key;
    if (!value) {
      const inferred = inferGenericTextAnswer(label, resumeData);
      if (inferred && inferred.value) {
        value = inferred.value;
        valueKey = inferred.key;
        usedFallback = true;
      }
    }
  } else {
    const inferred = inferGenericTextAnswer(label, resumeData);
    if (!inferred || !inferred.value) return false;
    value = inferred.value;
    valueKey = inferred.key;
    usedFallback = true;
  }

  if (!value) return false;

  if (hooks && typeof hooks.onMatch === "function") {
    try {
      hooks.onMatch({
        kind: "text",
        field,
        label,
        key: valueKey,
        value: String(value),
        fallback: usedFallback,
      });
    } catch {
      /* debug hook must not break fill */
    }
  }

  if (typeof setNativeValue === "function") {
    setNativeValue(field, value);
  } else {
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (hooks && typeof hooks.onFill === "function") {
    try {
      hooks.onFill({
        kind: "text",
        field,
        label,
        key: valueKey,
        value,
        fallback: usedFallback,
      });
    } catch {
      /* ignore */
    }
  }
  if (usedFallback && typeof console !== "undefined" && console.log) {
    console.log(
      "[JobPilot][Naukri][Fill] generic fallback",
      valueKey,
      "→",
      String(value).slice(0, 80),
      "| label:",
      String(label).slice(0, 120)
    );
  }
  return true;
}

function fillDropdown(select, resumeData, hooks) {
  if (select.value && select.selectedIndex > 0) return false;

  const label =
    typeof getFieldLabel === "function"
      ? getFieldLabel(select)
      : select.getAttribute("aria-label") ||
        select.getAttribute("name") ||
        "";

  const mapped = matchFieldToKey(label);
  const desired = mapped
    ? resolveValue(mapped.key, resumeData, mapped.fallback)
    : "";

  const options = Array.from(select.options).filter(
    (o) => o.value && o.value !== "" && !o.disabled
  );

  const emitMatch = (key, valueForLog) => {
    if (!hooks || typeof hooks.onMatch !== "function") return;
    try {
      hooks.onMatch({
        kind: "select",
        field: select,
        label,
        key: key || "select_first_option",
        value: valueForLog != null ? String(valueForLog) : "",
      });
    } catch {
      /* ignore */
    }
  };
  const emitFill = (key, valueForLog) => {
    if (!hooks || typeof hooks.onFill !== "function") return;
    try {
      hooks.onFill({ kind: "select", field: select, label, key, value: valueForLog });
    } catch {
      /* ignore */
    }
  };

  if (desired) {
    const desiredLower = desired.toLowerCase();

    const exact = options.find(
      (o) =>
        o.value.toLowerCase() === desiredLower ||
        o.textContent.trim().toLowerCase() === desiredLower
    );
    if (exact) {
      if (mapped) emitMatch(mapped.key, exact.value);
      select.value = exact.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      emitFill(mapped ? mapped.key : "select", exact.value);
      return true;
    }

    const partial = options.find(
      (o) =>
        o.textContent.trim().toLowerCase().includes(desiredLower) ||
        desiredLower.includes(o.textContent.trim().toLowerCase())
    );
    if (partial) {
      if (mapped) emitMatch(mapped.key, partial.value);
      select.value = partial.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      emitFill(mapped ? mapped.key : "select", partial.value);
      return true;
    }
  }

  if (options.length > 0) {
    emitMatch(mapped ? mapped.key : "select_first_option", options[0].value);
    select.value = options[0].value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    emitFill(mapped ? mapped.key : "select_first_option", options[0].value);
    return true;
  }
  return false;
}

/**
 * Find the visible clickable element for a radio input.
 * Naukri chatbot hides the real <input type="radio"> (opacity:0/display:none)
 * and renders a styled label/wrapper the user actually clicks.
 * Clicking the hidden input via .click() fires the event but React's state
 * doesn't update — we must click the visible wrapper instead.
 */
function _getRadioClickTarget(radioEl) {
  try {
    const esc =
      radioEl.id && typeof CSS !== "undefined" && CSS.escape
        ? CSS.escape(radioEl.id)
        : radioEl.id || null;

    // 1. Sibling <label for="id"> inside the SAME container div (most reliable).
    //    Naukri DOM: <div class="ssrc__radio-btn-container">
    //                  <input type="radio" id="Yes" class="ssrc__radio">
    //                  <label for="Yes" class="ssrc__label">Yes</label>
    //                </div>
    //    Searching parent first avoids picking up a different question's label
    //    that shares the same for="Yes" value.
    if (esc && radioEl.parentElement) {
      const sibLbl = radioEl.parentElement.querySelector(`label[for="${esc}"]`);
      if (sibLbl) return sibLbl;
    }

    // 2. Any label inside the parent container
    if (radioEl.parentElement) {
      const anyLbl = radioEl.parentElement.querySelector("label");
      if (anyLbl) return anyLbl;
    }

    // 3. Wrapping <label> (input is inside the label element)
    const wrapLabel = radioEl.closest("label");
    if (wrapLabel) return wrapLabel;

    // 4. Document-level <label for="id"> fallback
    if (esc) {
      const rootNode = radioEl.getRootNode() || document;
      const lbl = rootNode.querySelector && rootNode.querySelector(`label[for="${esc}"]`);
      if (lbl) return lbl;
    }

    // 5. Named container wrapper (ssrc__radio-btn-container, option, choice, etc.)
    const wrapper = radioEl.closest(
      "[class*='radio-btn-container'], [class*='option'], [class*='choice'], [class*='Option'], [class*='Choice']"
    );
    if (wrapper && wrapper !== radioEl) return wrapper;

    // 6. Parent element as absolute last resort
    if (radioEl.parentElement) return radioEl.parentElement;
  } catch { /* ignore */ }
  return radioEl;
}

function _fireFullClick(el) {
  if (!el) return;
  try { el.scrollIntoView({ block: "center", behavior: "instant" }); } catch {}
  const opts = { bubbles: true, cancelable: true, composed: true };
  try { el.dispatchEvent(new PointerEvent("pointerover",  { ...opts })); } catch {}
  try { el.dispatchEvent(new PointerEvent("pointerenter", { ...opts, bubbles: false })); } catch {}
  try { el.dispatchEvent(new MouseEvent("mouseover",  opts)); } catch {}
  try { el.dispatchEvent(new MouseEvent("mouseenter", { ...opts, bubbles: false })); } catch {}
  try { el.dispatchEvent(new PointerEvent("pointerdown", opts)); } catch {}
  try { el.dispatchEvent(new MouseEvent("mousedown",  opts)); } catch {}
  try { el.dispatchEvent(new PointerEvent("pointerup",   opts)); } catch {}
  try { el.dispatchEvent(new MouseEvent("mouseup",    opts)); } catch {}
  try { el.dispatchEvent(new MouseEvent("click",      opts)); } catch {}
  try { el.click(); } catch {}
}

function fillRadioGroup(radios, hooks) {
  const radioArr = Array.from(radios);
  if (radioArr.length === 0) return false;

  const checkedList = radioArr.filter((r) => r.checked);
  const isResync = checkedList.length > 0;
  /** Target: first unchecked option, or the already-checked input (React DOM sync). */
  const focusRadio = isResync ? checkedList[0] : radioArr[0];

  if (hooks && typeof hooks.onMatch === "function") {
    try {
      const label =
        typeof getFieldLabel === "function"
          ? getFieldLabel(focusRadio)
          : focusRadio.getAttribute("name") || "radio";
      hooks.onMatch({
        kind: "radio",
        field: focusRadio,
        label,
        key: isResync ? "radio_group_resync" : "radio_group",
        value:
          focusRadio.value ||
          focusRadio.id ||
          (isResync ? "(resync)" : "(first option)"),
      });
    } catch { /* ignore */ }
  }

  // Click the visible wrapper/label — NOT the hidden input.
  // When a user clicks a Naukri chatbot radio button they click the styled
  // label div, not the underlying <input>. Clicking the hidden input fires
  // events that bubble to React's root listener, but React's tracker sees the
  // input was already "hidden/not interactable" and doesn't update state.
  const clickTarget = _getRadioClickTarget(focusRadio);
  _fireFullClick(clickTarget);

  try {
    if (!isResync) {
      for (const r of radioArr) {
        r.checked = r === focusRadio;
      }
    }
    focusRadio.dispatchEvent(new Event("change", { bubbles: true }));
    focusRadio.dispatchEvent(new Event("input", { bubbles: true }));
  } catch { /* ignore */ }

  if (hooks && typeof hooks.onFill === "function") {
    try {
      hooks.onFill({
        kind: "radio",
        field: focusRadio,
        key: isResync ? "radio_group_resync" : "radio_group",
        value: focusRadio.value || true,
      });
    } catch { /* ignore */ }
  }
  return true;
}

/**
 * Re-click visible labels for every radio group that already has a selection.
 * Naukri/React often leaves Save disabled when .checked was set without a real
 * user-like click; this runs after batch fills as a second sync pass.
 *
 * @param {Element} [root]
 * @returns {number} groups nudged
 */
function nudgeRadioGroupsReact(root) {
  const container = root || document;
  const radioGroups = new Map();
  _queryAllDeep(container, "input[type='radio']").forEach((r) => {
    const name = r.getAttribute("name");
    if (!name || radioGroups.has(name)) return;
    const group = _queryAllDeep(container, "input[type='radio']").filter(
      (x) => x.getAttribute("name") === name
    );
    radioGroups.set(name, group);
  });
  let n = 0;
  radioGroups.forEach((group) => {
    const checked = group.filter((r) => r.checked);
    if (checked.length === 0) return;
    const el = checked[0];
    if (!el.isConnected) return;
    const clickTarget = _getRadioClickTarget(el);
    _fireFullClick(clickTarget);
    try {
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } catch { /* ignore */ }
    n++;
  });
  return n;
}

function _queryAllDeep(root, selector) {
  if (
    typeof globalThis.PanelKernel !== "undefined" &&
    globalThis.PanelKernel.deepQuerySelectorAll
  ) {
    return globalThis.PanelKernel.deepQuerySelectorAll(root, selector);
  }
  return Array.from(root.querySelectorAll(selector));
}

function fillAllFields(container, resumeData, hooks) {
  let filled = 0;
  const root = container || document;

  _queryAllDeep(
    root,
    "input[type='text'], input[type='number'], input[type='tel'], input[type='email'], input:not([type]), textarea"
  ).forEach((f) => {
    if (f.type === "hidden" || f.type === "file") return;
    if (fillTextField(f, resumeData, hooks)) filled++;
  });

  _queryAllDeep(root, "select").forEach((s) => {
    if (fillDropdown(s, resumeData, hooks)) filled++;
  });

  const radioGroups = new Map();
  _queryAllDeep(root, "input[type='radio']").forEach((r) => {
    const name = r.getAttribute("name");
    if (name && !radioGroups.has(name)) {
      const group = _queryAllDeep(root, "input[type='radio']").filter(
        (x) => x.getAttribute("name") === name
      );
      radioGroups.set(name, group);
    }
  });
  radioGroups.forEach((radios) => {
    if (fillRadioGroup(radios, hooks)) filled++;
  });

  return filled;
}
