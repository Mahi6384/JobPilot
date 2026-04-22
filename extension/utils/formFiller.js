function _fieldLabelForLog(el) {
  if (!el) return "";
  return typeof getFieldLabel === "function"
    ? getFieldLabel(el)
    : el.getAttribute("aria-label") ||
        el.getAttribute("placeholder") ||
        el.getAttribute("name") ||
        "";
}

function _normalizeText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function _delay(ms) {
  try {
    if (typeof delay === "function") return delay(ms);
  } catch {
    /* ignore */
  }
  return new Promise((r) => setTimeout(r, ms));
}

function buildResumeText(resumeData) {
  if (!resumeData || typeof resumeData !== "object") return "";
  try {
    const parts = [];
    if (resumeData.name) parts.push(`Name: ${resumeData.name}`);
    if (resumeData.email) parts.push(`Email: ${resumeData.email}`);
    if (resumeData.phone) parts.push(`Phone: ${resumeData.phone}`);
    if (resumeData.location) parts.push(`Location: ${resumeData.location}`);

    const skills = Array.isArray(resumeData.skills) ? resumeData.skills : [];
    if (skills.length) parts.push(`Skills: ${skills.slice(0, 40).join(", ")}`);

    const exp = resumeData.experience || {};
    if (exp.years != null) parts.push(`Experience: ${String(exp.years)} years`);
    if (exp.currentTitle) parts.push(`Current title: ${exp.currentTitle}`);
    if (exp.currentCompany) parts.push(`Current company: ${exp.currentCompany}`);

    const entries = Array.isArray(exp.entries) ? exp.entries : [];
    for (const e of entries.slice(0, 3)) {
      if (!e || typeof e !== "object") continue;
      const line = [
        e.title ? String(e.title) : "",
        e.company ? String(e.company) : "",
        e.description ? String(e.description) : "",
      ]
        .filter(Boolean)
        .join(" — ");
      if (line) parts.push(`Experience: ${line}`);
    }

    const edu = Array.isArray(resumeData.education) ? resumeData.education : [];
    for (const e of edu.slice(0, 2)) {
      if (!e || typeof e !== "object") continue;
      const line = [
        e.school ? String(e.school) : "",
        e.degree ? String(e.degree) : "",
        e.fieldOfStudy ? String(e.fieldOfStudy) : "",
      ]
        .filter(Boolean)
        .join(" — ");
      if (line) parts.push(`Education: ${line}`);
    }

    return _normalizeText(parts.join("\n"));
  } catch {
    return "";
  }
}

function _isNumericLikeField(field) {
  if (!field) return false;
  const t = String(field.type || "").toLowerCase();
  if (t === "number" || t === "range") return true;
  const im = String(field.getAttribute?.("inputmode") || "").toLowerCase();
  if (im === "numeric" || im === "decimal") return true;
  const pat = String(field.getAttribute?.("pattern") || "");
  if (/\d|decimal|number|numeric/i.test(pat)) return true;
  return false;
}

function _isLongAnswerField(field) {
  if (!field) return false;
  if (String(field.tagName || "").toUpperCase() === "TEXTAREA") return true;
  if (String(field.getAttribute?.("aria-multiline") || "").toLowerCase() === "true")
    return true;

  // Some ATS use long text inputs; treat as long if maxLength is large.
  const maxLenRaw = field.getAttribute?.("maxlength");
  const maxLen = maxLenRaw != null ? Number(maxLenRaw) : NaN;
  if (Number.isFinite(maxLen) && maxLen >= 120) return true;
  return false;
}

function shouldUseAI(field, labelText) {
  // Only consider long-answer fields.
  if (!_isLongAnswerField(field)) return false;

  // Do not use AI for numeric-like fields.
  if (_isNumericLikeField(field)) return false;

  const label = _normalizeText(labelText);
  if (!label || label.length < 8) return false;

  const lower = label.toLowerCase();

  // Avoid common simple fields even if they are rendered oddly.
  const simpleBlock = [
    /\bcity\b/i,
    /\bpincode\b/i,
    /\bpin\s*code\b/i,
    /\bzip\b/i,
    /\bpostal\b/i,
    /\bstate\b/i,
    /\bcountry\b/i,
    /\baddress\b/i,
    /\blinkedin\b/i,
    /\bgithub\b/i,
    /\bportfolio\b/i,
    /\bwebsite\b/i,
    /\burl\b/i,
    /\bphone\b/i,
    /\bemail\b/i,
    /\bname\b/i,
  ];
  if (simpleBlock.some((re) => re.test(lower))) return false;

  // Trigger only on question-like prompts.
  const triggers = [
    /\bwhy\b/i,
    /\bdescribe\b/i,
    /\btell\b/i,
    /\bexplain\b/i,
    /\bexperience\b/i,
    /\bproject\b/i,
    /\bmotivation\b/i,
  ];
  return triggers.some((re) => re.test(lower));
}

async function _apiGenerateAnswer(payload) {
  // Prefer injected apiCall (extension utils/api.js). Keep a minimal fallback if not present.
  if (typeof apiCall === "function") {
    const resp = await apiCall("/ai/generate-answer", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return resp?.answer || "";
  }

  // Fallback: attempt direct fetch by reading storage (still works inside content script).
  const API_URLS = {
    prod: "https://jobpilot-production-3ba1.up.railway.app/api",
    dev: "http://localhost:5000/api",
  };
  const [cfgResult, tokenResult] = await Promise.all([
    chrome.storage.local.get("jpConfig"),
    chrome.storage.local.get("authToken"),
  ]);
  const mode = cfgResult.jpConfig?.apiMode || "prod";
  const base = API_URLS[mode] || API_URLS.prod;
  const token = tokenResult.authToken;

  const resp = await fetch(`${base}/ai/generate-answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  return data?.answer || "";
}

async function fillLongAnswerWithAI(field, labelText, resumeData, jobContext, hooks) {
  try {
    if (!field || !field.isConnected) return false;
    if (field.value && String(field.value).trim() !== "") return false; // never overwrite

    const label = _normalizeText(labelText || _fieldLabelForLog(field));
    if (!shouldUseAI(field, label)) {
      if (hooks && typeof hooks.onSkip === "function") {
        try {
          hooks.onSkip({ kind: "ai", field, label, reason: "shouldUseAI_false" });
        } catch {
          /* ignore */
        }
      }
      return false;
    }

    // Only use AI if we truly cannot fill from known data.
    const mapped = matchFieldToKey(label);
    if (mapped) {
      const v = resolveValue(mapped.key, resumeData, mapped.fallback);
      if (v) return false;
    }
    const inferred = inferGenericTextAnswer(label, resumeData);
    if (inferred && inferred.value) return false;

    const resumeText = buildResumeText(resumeData);
    if (!resumeText) {
      if (hooks && typeof hooks.onSkip === "function") {
        try {
          hooks.onSkip({ kind: "ai", field, label, reason: "no_resumeText" });
        } catch {
          /* ignore */
        }
      }
      return false;
    }

    if (hooks && typeof hooks.onMatch === "function") {
      try {
        hooks.onMatch({
          kind: "ai",
          field,
          label,
          key: "ai_generate_answer",
          value: "(request)",
        });
      } catch {
        /* ignore */
      }
    }

    const payload = {
      question: label,
      resumeText,
      jobTitle: jobContext?.jobTitle || null,
      companyName: jobContext?.companyName || null,
      jobDescription: jobContext?.jobDescription || null,
    };

    let answer = "";
    try {
      answer = _normalizeText(await _apiGenerateAnswer(payload));
    } catch {
      answer = "";
    }

    if (!answer) answer = "Looking forward to discussing this in detail.";

    // Human-ish typing (very light): set progressively for textareas.
    if (typeof setNativeValue === "function") {
      try {
        field.focus?.();
      } catch {
        /* ignore */
      }
      if (String(field.tagName || "").toUpperCase() === "TEXTAREA" && answer.length <= 900) {
        let cur = "";
        for (const ch of answer) {
          cur += ch;
          setNativeValue(field, cur);
          await _delay(12 + Math.floor(Math.random() * 18));
        }
      } else {
        setNativeValue(field, answer);
      }
    } else {
      field.value = answer;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (hooks && typeof hooks.onFill === "function") {
      try {
        hooks.onFill({
          kind: "ai",
          field,
          label,
          key: "ai_generate_answer",
          value: answer,
        });
      } catch {
        /* ignore */
      }
    }

    return true;
  } catch (e) {
    if (hooks && typeof hooks.onSkip === "function") {
      try {
        hooks.onSkip({
          kind: "ai",
          field,
          label: _fieldLabelForLog(field),
          reason: `ai_error:${e?.message || "unknown"}`,
        });
      } catch {
        /* ignore */
      }
    }
    return false;
  }
}

const FIELD_MAP = [
  {
    patterns: [/full\s*name/i, /your\s*name/i, /^name$/i, /candidate\s*name/i, /applicant\s*name/i, /first\s*(?:and|&)?\s*last\s*name/i],
    key: "name",
  },
  {
    // Workday: "Given Name(s)" / "First Name"
    patterns: [/\bgiven\s*name/i, /\bfirst\s*name/i],
    key: "firstName",
  },
  {
    // Workday: "Family Name" / "Last Name" / "Surname"
    patterns: [/\bfamily\s*name/i, /\blast\s*name/i, /\bsurname\b/i],
    key: "lastName",
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
    patterns: [
      /current\s*(?:company|employer|organi[sz]ation)/i,
      /present\s*(?:company|employer)/i,
      /most\s+recent\s+(?:employer|company)/i,
      /previous\s*(?:company|employer)/i,
      /\bemployer\b/i,
      /\bcompany\s*name\b/i,
    ],
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

  const fullName = String(resumeData.name || "").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const derivedFirstName = nameParts[0] || "";
  const derivedLastName =
    nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

  const directMap = {
    name: resumeData.name,
    firstName: derivedFirstName,
    lastName: derivedLastName,
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
    case "currentCompany": {
      const direct = resumeData.experience?.currentCompany;
      if (direct && String(direct).trim()) return String(direct).trim();
      const entries = resumeData.experience?.entries || [];
      const cur =
        entries.find((e) => e && e.isCurrent) || entries[0];
      const fromEntry = cur?.company && String(cur.company).trim();
      return fromEntry || fallback || "";
    }
    case "currentTitle": {
      const direct = resumeData.experience?.currentTitle;
      if (direct && String(direct).trim()) return String(direct).trim();
      const entries = resumeData.experience?.entries || [];
      const cur =
        entries.find((e) => e && e.isCurrent) || entries[0];
      const fromEntry = cur?.title && String(cur.title).trim();
      return fromEntry || fallback || "";
    }
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
    const did = fillTextField(f, resumeData, hooks);
    if (did) {
      filled++;
    }
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

// Expose small helpers for platform scripts (LinkedIn/Workday).
try {
  globalThis.shouldUseAI = shouldUseAI;
  globalThis.fillLongAnswerWithAI = fillLongAnswerWithAI;
  globalThis.buildResumeText = buildResumeText;
} catch {
  /* ignore */
}
