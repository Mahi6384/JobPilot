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
    patterns: [/current\s*(?:ctc|salary|compensation)/i, /present\s*(?:ctc|salary)/i, /annual\s*(?:ctc|salary)/i, /salary\s*expectation/i, /desired\s*pay/i],
    key: "currentCtc",
  },
  {
    patterns: [/expected\s*(?:ctc|salary|compensation)/i, /desired\s*(?:salary|ctc)/i],
    key: "expectedSalary",
  },
  {
    patterns: [/(?:total\s*)?(?:years?\s*of\s*)?(?:work\s*|professional\s*)?experience/i, /total\s*exp/i, /experience\s*in\s*years/i],
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

function fillTextField(field, resumeData) {
  if (field.value && field.value.trim() !== "") return false;

  const label =
    typeof getFieldLabel === "function"
      ? getFieldLabel(field)
      : field.getAttribute("aria-label") ||
        field.getAttribute("placeholder") ||
        field.getAttribute("name") ||
        "";

  const mapped = matchFieldToKey(label);
  if (!mapped) return false;

  const value = resolveValue(mapped.key, resumeData, mapped.fallback);
  if (!value) return false;

  if (typeof setNativeValue === "function") {
    setNativeValue(field, value);
  } else {
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return true;
}

function fillDropdown(select, resumeData) {
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

  if (desired) {
    const desiredLower = desired.toLowerCase();

    const exact = options.find(
      (o) =>
        o.value.toLowerCase() === desiredLower ||
        o.textContent.trim().toLowerCase() === desiredLower
    );
    if (exact) {
      select.value = exact.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    const partial = options.find(
      (o) =>
        o.textContent.trim().toLowerCase().includes(desiredLower) ||
        desiredLower.includes(o.textContent.trim().toLowerCase())
    );
    if (partial) {
      select.value = partial.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
  }

  if (options.length > 0) {
    select.value = options[0].value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  return false;
}

function fillRadioGroup(radios) {
  const radioArr = Array.from(radios);
  if (radioArr.some((r) => r.checked)) return false;
  if (radioArr.length === 0) return false;

  radioArr[0].checked = true;
  radioArr[0].dispatchEvent(new Event("change", { bubbles: true }));
  radioArr[0].click();
  return true;
}

function fillAllFields(container, resumeData) {
  let filled = 0;
  const root = container || document;

  root
    .querySelectorAll(
      "input[type='text'], input[type='number'], input[type='tel'], input[type='email'], input:not([type]), textarea"
    )
    .forEach((f) => {
      if (f.type === "hidden" || f.type === "file") return;
      if (fillTextField(f, resumeData)) filled++;
    });

  root.querySelectorAll("select").forEach((s) => {
    if (fillDropdown(s, resumeData)) filled++;
  });

  const radioGroups = new Map();
  root.querySelectorAll("input[type='radio']").forEach((r) => {
    const name = r.getAttribute("name");
    if (name && !radioGroups.has(name)) {
      radioGroups.set(
        name,
        root.querySelectorAll(`input[type='radio'][name='${name}']`)
      );
    }
  });
  radioGroups.forEach((radios) => {
    if (fillRadioGroup(radios)) filled++;
  });

  return filled;
}
