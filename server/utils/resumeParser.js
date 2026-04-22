/**
 * Resume text parser — extracts structured data from raw resume text.
 * Pure logic, no Express/DB dependencies.
 */

const COMMON_SKILLS = [
  "javascript", "python", "java", "c++", "c#", "ruby", "php", "typescript",
  "swift", "kotlin", "go", "rust", "html", "css", "react", "angular", "vue",
  "node.js", "express", "django", "flask", "spring", "asp.net", "sql", "mysql",
  "postgresql", "mongodb", "redis", "elasticsearch", "aws", "azure", "gcp",
  "docker", "kubernetes", "git", "linux", "unix", "agile", "scrum",
  "machine learning", "data science", "nlp", "tensorflow", "pytorch",
  "next.js", "tailwind", "graphql", "rest api", "ci/cd", "jenkins",
  "terraform", "ansible", "power bi", "tableau", "excel", "figma",
  "photoshop", "jira", "confluence", "salesforce", "sap",
];

const SKILL_DISPLAY = {
  javascript: "JavaScript", typescript: "TypeScript", java: "Java",
  python: "Python", react: "React", "node.js": "Node.js", html: "HTML",
  css: "CSS", sql: "SQL", aws: "AWS", gcp: "GCP", docker: "Docker",
  kubernetes: "Kubernetes", "c++": "C++", "c#": "C#", php: "PHP",
  ruby: "Ruby", swift: "Swift", kotlin: "Kotlin", go: "Go", rust: "Rust",
  angular: "Angular", vue: "Vue", express: "Express", django: "Django",
  flask: "Flask", spring: "Spring", "asp.net": "ASP.NET", mysql: "MySQL",
  postgresql: "PostgreSQL", mongodb: "MongoDB", redis: "Redis",
  elasticsearch: "Elasticsearch", azure: "Azure", git: "Git", linux: "Linux",
  unix: "Unix", agile: "Agile", scrum: "Scrum", "machine learning": "Machine Learning",
  "data science": "Data Science", nlp: "NLP", tensorflow: "TensorFlow",
  pytorch: "PyTorch", "next.js": "Next.js", tailwind: "Tailwind",
  graphql: "GraphQL", "rest api": "REST API", "ci/cd": "CI/CD",
  jenkins: "Jenkins", terraform: "Terraform", ansible: "Ansible",
  "power bi": "Power BI", tableau: "Tableau", excel: "Excel", figma: "Figma",
  photoshop: "Photoshop", jira: "Jira", confluence: "Confluence",
  salesforce: "Salesforce", sap: "SAP",
};

/**
 * Extracts structured resume data from raw text.
 * @param {string} text - Raw text extracted from a PDF resume
 * @returns {{ name, email, phone, skills, experience, education, socials, experienceEntries, educationEntries, expectedSalary, currentCtc }}
 */
function extractStructuredResume(text) {
  const lower = text.toLowerCase();

  const emailMatch = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  const phoneMatch = text.match(
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
  );

  const nameMatch = text.split("\n").find((line) => {
    const trimmed = line.trim();
    return (
      trimmed.length > 2 &&
      trimmed.length < 60 &&
      /^[A-Z][a-z]/.test(trimmed) &&
      !/@/.test(trimmed) &&
      !/^(summary|objective|experience|education|skills|projects)/i.test(trimmed)
    );
  });

  const skills = extractSkills(lower);
  const roles = extractRoles(text);
  const education = extractEducation(text);
  const socials = extractSocialLinks(text);
  const experienceEntries = extractExperienceEntries(text);
  const educationEntries = extractEducationEntries(text);

  const yearsMatch = lower.match(/\b(\d{1,2})\s*\+?\s*years?\b/);
  const yearsOfExperience = yearsMatch ? parseInt(yearsMatch[1]) : 0;

  const salaryMatch = lower.match(
    /(?:expected|desired)\s*(?:salary|ctc|compensation)[:\s]*(?:rs\.?\s*|inr\s*|₹\s*)?(\d[\d,.]*)\s*(?:lpa|lakhs?|l|per\s*annum)?/
  );
  const ctcMatch = lower.match(
    /(?:current|present)\s*(?:ctc|salary|compensation)[:\s]*(?:rs\.?\s*|inr\s*|₹\s*)?(\d[\d,.]*)\s*(?:lpa|lakhs?|l|per\s*annum)?/
  );

  return {
    name: nameMatch?.trim() || null,
    email: emailMatch?.[0] || null,
    phone: phoneMatch?.[0] || null,
    skills: Array.from(skills),
    experience: { years: yearsOfExperience, roles },
    education,
    socials,
    experienceEntries,
    educationEntries,
    expectedSalary: salaryMatch ? salaryMatch[1].replace(/,/g, "") : null,
    currentCtc: ctcMatch ? ctcMatch[1].replace(/,/g, "") : null,
  };
}

function extractSkills(lowerText) {
  const skills = new Set();
  COMMON_SKILLS.forEach((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const startBound = /^\w/.test(skill) ? "\\b" : "";
    const endBound = /\w$/.test(skill) ? "\\b" : "(?![a-zA-Z0-9_])";
    const regex = new RegExp(`${startBound}${escaped}${endBound}`, "i");
    if (regex.test(lowerText)) {
      skills.add(SKILL_DISPLAY[skill] || skill.charAt(0).toUpperCase() + skill.slice(1));
    }
  });
  return skills;
}

function extractRoles(text) {
  const roles = [];
  const patterns = [
    /(?:software|senior|junior|lead|staff|principal|full[\s-]?stack|front[\s-]?end|back[\s-]?end)\s+(?:engineer|developer|architect)/gi,
    /(?:data|ml|ai)\s+(?:engineer|scientist|analyst)/gi,
    /(?:product|project|engineering)\s+manager/gi,
    /(?:devops|sre|cloud)\s+engineer/gi,
    /(?:ui|ux|ui\/ux)\s+(?:designer|developer)/gi,
  ];
  patterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((m) => {
        const normalized = m.trim().replace(/\s+/g, " ");
        if (!roles.includes(normalized)) roles.push(normalized);
      });
    }
  });
  return roles;
}

function extractEducation(text) {
  const education = [];
  const patterns = [
    /\b(?:B\.?Tech|B\.?E\.?|B\.?Sc|B\.?S\.?|M\.?Tech|M\.?S\.?|M\.?Sc|M\.?B\.?A|Ph\.?D|Bachelor|Master|Doctorate|BCA|MCA|BCom|MCom|BBA|Diploma|Higher\s+Secondary|HSC|SSC|10th|12th)\b[^.\n]{0,100}/gi,
  ];
  patterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((m) => {
        const cleaned = m.trim().replace(/\s+/g, " ");
        if (cleaned.length > 5 && !education.includes(cleaned)) {
          education.push(cleaned);
        }
      });
    }
  });
  return education;
}

function extractSocialLinks(text) {
  const out = {
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    twitterUrl: null,
  };

  const urls = (text.match(/https?:\/\/[^\s)\]]+/gi) || []).map((u) =>
    u.replace(/[.,;]+$/, "")
  );

  for (const u of urls) {
    const lower = u.toLowerCase();
    if (!out.linkedinUrl && lower.includes("linkedin.com/")) out.linkedinUrl = u;
    if (!out.githubUrl && lower.includes("github.com/")) out.githubUrl = u;
    if (!out.twitterUrl && (lower.includes("twitter.com/") || lower.includes("x.com/")))
      out.twitterUrl = u;
  }

  // Portfolio heuristics: first non-linkedin/non-github URL that is not a common tracker
  for (const u of urls) {
    const lower = u.toLowerCase();
    if (
      lower.includes("linkedin.com/") ||
      lower.includes("github.com/") ||
      lower.includes("twitter.com/") ||
      lower.includes("x.com/") ||
      lower.includes("mailto:")
    )
      continue;
    if (!out.portfolioUrl) {
      out.portfolioUrl = u;
      break;
    }
  }

  return out;
}

function extractExperienceEntries(text) {
  const allLines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Prefer parsing inside an EXPERIENCE section to avoid false positives.
  const lines =
    sliceBetweenHeadings(
      allLines,
      ["experience", "work experience", "professional experience", "employment"],
      ["education", "skills", "projects", "certifications", "achievements"]
    ) || allLines;

  const entries = [];
  // More flexible date ranges:
  // - "Feb 2025 – Present"
  // - "04/2023 - 06/2023"
  // - "2021 - 2025"
  // - "Feb'25 - Present"
  const monthToken =
    "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const dateToken = `(?:${monthToken}\\s*'?\\s*(?:19\\d{2}|20\\d{2})|(?:0?[1-9]|1[0-2])\\s*\\/\\s*(?:19\\d{2}|20\\d{2})|(?:19\\d{2}|20\\d{2}))`;
  const dateRangeRe = new RegExp(
    `\\b(${dateToken})\\s*(?:[-–—]|to)\\s*((?:present|current|now)|${dateToken})\\b`,
    "i"
  );

  const headingLike = (l) =>
    /^(?:experience|work experience|professional experience|employment|education|skills|projects|certifications|achievements|summary|objective)\b/i.test(l);

  const looksLikeTitle = (s) =>
    /(engineer|developer|analyst|designer|manager|lead|intern|architect|consultant|specialist|associate|scientist|researcher|director|officer|executive|internship)\b/i.test(
      s
    );
  const looksLikeCompany = (s) =>
    /(inc|ltd|llc|technologies|technology|solutions|systems|corp|company|pvt|private|limited|university|institute|group|holdings|ventures|studio|agency)\b/i.test(
      s
    );

  const pushEntry = (entry) => {
    const key = (entry.title + "@" + entry.company).toLowerCase();
    if (!entries.some((e) => (e.title + "@" + e.company).toLowerCase() === key)) {
      entries.push(entry);
    }
  };

  const isBullet = (l) => /^[•*-]\s+/.test(String(l || ""));

  const isSectionHeading = (l) => {
    const t = String(l || "").trim().toLowerCase();
    if (!t) return false;
    return /^(experience|work experience|professional experience|employment|projects|education|skills|technical skills|certifications|achievements|summary|professional summary|objective)\b/.test(
      t
    );
  };

  const normalizeSpaces = (s) => String(s || "").replace(/\s+/g, " ").trim();

  const parseHeaderWithDates = (line) => {
    const s = String(line || "");
    const dm = s.match(dateRangeRe);
    if (!dm) return null;
    const beforeRaw = s.slice(0, dm.index);
    // pdf-parse sometimes removes the space between company and month (e.g. "Qureal AIFeb 2025 – Present"),
    // which can cause the date regex to start at the year ("2025 – Present") leaving "Feb" attached to company.
    // If that happens, pull a trailing month token from `beforeRaw` into the start token.
    let startToken = dm[1];
    let beforeWork = beforeRaw;
    if (/^(?:19\d{2}|20\d{2})$/.test(String(startToken).trim())) {
      const monthAtEnd = beforeWork.match(
        /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*$/i
      );
      if (monthAtEnd) {
        beforeWork = beforeWork.slice(0, monthAtEnd.index);
        startToken = `${monthAtEnd[1]} ${startToken}`;
      }
    }

    const before = normalizeSpaces(beforeWork);
    if (!before || before.length < 4) return null;
    const parts = before
      .split(/\s*(?:\||·|—|–|-)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2) return null;
    return { left: parts[0], right: parts.slice(1).join(" "), start: startToken, end: dm[2] };
  };

  const parseTwoLineHeader = (line, nextLine) => {
    if (!nextLine) return null;
    const dm = String(nextLine).match(dateRangeRe);
    if (!dm) return null;
    const head = normalizeSpaces(line);
    if (!head || head.length < 4 || head.length > 180) return null;
    if (isSectionHeading(head)) return null;
    if (isBullet(head)) return null;
    const parts = head
      .split(/\s*(?:\||·|—|–|-)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2) return null;
    return { left: parts[0], right: parts.slice(1).join(" "), start: dm[1], end: dm[2] };
  };

  const decideTitleCompany = (a, b) => {
    const scoreTitle = (s) =>
      (looksLikeTitle(s) ? 2 : 0) +
      (/\b(intern|engineer|developer|manager|analyst|designer|lead|architect|consultant)\b/i.test(
        s
      )
        ? 1
        : 0);
    const scoreCompany = (s) =>
      (looksLikeCompany(s) ? 2 : 0) +
      (/\b(communication|labs|ai|solutions|systems|studio|agency|group|university)\b/i.test(s)
        ? 1
        : 0);

    const asIs = scoreTitle(a) + scoreCompany(b);
    const swapped = scoreTitle(b) + scoreCompany(a);
    if (swapped > asIs) return { title: b, company: a };
    return { title: a, company: b };
  };

  const isJobHeaderLine = (line, nextLine) =>
    Boolean(parseHeaderWithDates(line) || parseTwoLineHeader(line, nextLine));

  for (let i = 0; i < lines.length && entries.length < 5; i++) {
    const line = lines[i];
    const next = lines[i + 1] || "";
    if (!line) continue;
    if (line.length < 4 || line.length > 220) continue;
    if (headingLike(line) || isSectionHeading(line)) continue;
    if (isBullet(line)) continue;

    const oneLine = parseHeaderWithDates(line);
    const twoLine = oneLine ? null : parseTwoLineHeader(line, next);
    const header = oneLine || twoLine;
    if (!header) continue;

    const chosen = decideTitleCompany(header.left, header.right);
    const startParts = parseMonthYear(header.start);
    const endParts = parseMonthYear(header.end);

    const entry = {
      title: String(chosen.title || "").slice(0, 120),
      company: String(chosen.company || "").slice(0, 120),
      location: null,
      startMonth: startParts.month,
      startYear: startParts.year,
      endMonth: endParts.month,
      endYear: endParts.year,
      isCurrent: /present|current|now/i.test(String(header.end || "")),
      description: null,
    };

    // Collect all bullets until next job header or a new section.
    const bullets = [];
    let j = i + 1;
    if (twoLine) j = i + 2; // skip date line if it's separate

    for (; j < lines.length; j++) {
      const cur = lines[j];
      const ahead = lines[j + 1] || "";
      if (!cur) continue;
      if (isSectionHeading(cur)) break;
      if (isJobHeaderLine(cur, ahead)) break;
      if (isBullet(cur)) bullets.push(String(cur).replace(/^[•*-]\s+/, "").trim());
    }

    if (bullets.length) entry.description = bullets.join("\n");
    pushEntry(entry);

    // Jump forward so we don't re-scan bullets within the same experience block.
    i = Math.max(i, j - 1);
  }

  return entries;
}

function extractEducationEntries(text) {
  const allLines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const scoped = sliceBetweenHeadings(
    allLines,
    [
      "education",
      "academics",
      "qualifications",
      "education & certifications",
      "education and certifications",
    ],
    [
      "experience",
      "work experience",
      "professional experience",
      "employment",
      "skills",
      "projects",
      "certifications",
    ]
  );

  const rawLines = scoped?.length ? scoped : allLines;
  const degreeRe =
    /\b(?:B\.?Tech|B\.?E\.?|B\.?Sc|B\.?S\.?|M\.?Tech|M\.?E\.?|M\.?S\.?|M\.?Sc|MBA|Ph\.?D\.?|BCA|MCA|B\.?Com|M\.?Com|BBA|Diploma|Higher\s+Secondary|HSC|SSC|Class\s*(?:10|12)|CBSE|ICSE|Bachelor|Bachelors|Master\'?s?|Master|Doctorate|Associate)\b/i;

  const looksLikeInstitution = (s) =>
    /(university|college|institute|school|academy|polytechnic|\bIIT\b|\bNIT\b|\bIIIT\b)/i.test(
      String(s || "")
    );

  const stripYearRange = (s) =>
    String(s || "").replace(
      /\b(19\d{2}|20\d{2})\s*[-–—]\s*((?:19\d{2}|20\d{2})|present|current)\b/gi,
      " "
    );

  const parseYearsFromText = (s) => {
    const m = String(s || "").match(
      /\b(19\d{2}|20\d{2})\s*[-–—]\s*((?:19\d{2}|20\d{2})|present|current)\b/i
    );
    if (!m) return { startYear: null, endYear: null };
    const startYear = parseInt(m[1], 10);
    const endRaw = m[2].toLowerCase();
    const endYear = /present|current/.test(endRaw) ? null : parseInt(m[2], 10);
    return { startYear, endYear };
  };

  const parseGpaFromText = (s) => {
    const m = String(s || "").match(
      /\b(?:cgpa|gpa)\s*[:\s]*([0-9]+(?:\.[0-9]+)?)(?:\s*\/\s*10)?|\b([0-9]+(?:\.[0-9]+)?)\s*%/i
    );
    if (!m) return null;
    return (m[1] || m[2] || "").trim();
  };

  const parseEducationLine = (line, prev, next) => {
    const s = String(line || "").trim();
    if (!s || s.length > 240) return null;
    if (/^(education|academics|qualifications)\b/i.test(s)) return null;
    if (/^https?:/i.test(s)) return null;
    if (/^\b(19\d{2}|20\d{2})\b\s*[-–—]\s*\b(19\d{2}|20\d{2})\b$/.test(s)) return null;

    const { startYear, endYear } = parseYearsFromText(s);
    const gpa = parseGpaFromText(s);
    let body = stripYearRange(s);
    body = body.replace(/\b(?:cgpa|gpa)\s*[:\s]*[0-9.]+\s*(?:\/\s*10)?/gi, " ");
    body = body.replace(/\b[0-9]+(?:\.[0-9]+)?\s*%/g, " ");
    body = body.replace(/\s+/g, " ").trim();

    const entry = {
      school: null,
      degree: null,
      fieldOfStudy: null,
      startMonth: null,
      startYear,
      endMonth: null,
      endYear,
      gpa,
    };

    if (degreeRe.test(s)) {
      const parts = body
        .split(/\s*[,|]\s*/)
        .map((p) => p.trim())
        .filter((p) => p.length > 1);
      const inst = parts.find((p) => looksLikeInstitution(p));
      const degIdx = parts.findIndex((p) => degreeRe.test(p));
      const deg = degIdx >= 0 ? parts[degIdx] : parts[0];

      if (inst && inst !== deg) {
        entry.school = inst.slice(0, 120);
        entry.degree = deg ? deg.slice(0, 120) : body.slice(0, 120);
      } else if (parts.length >= 2) {
        entry.degree = parts[0].slice(0, 120);
        entry.school = parts[1].slice(0, 120);
      } else {
        entry.degree = body.slice(0, 120);
        if (looksLikeInstitution(prev) && String(prev).length <= 120) entry.school = String(prev).trim();
        else if (looksLikeInstitution(next) && String(next).length <= 120)
          entry.school = String(next).trim();
      }

      const extra = parts.find(
        (p) =>
          p !== entry.school &&
          p !== entry.degree &&
          p.length > 2 &&
          !looksLikeInstitution(p) &&
          !degreeRe.test(p)
      );
      if (extra) entry.fieldOfStudy = extra.slice(0, 120);

      return entry;
    }

    if (looksLikeInstitution(s)) {
      entry.school = s.slice(0, 120);
      if (prev && degreeRe.test(String(prev))) {
        entry.degree = String(prev).trim().slice(0, 120);
      } else if (next && degreeRe.test(String(next))) {
        entry.degree = String(next).trim().slice(0, 120);
      } else if (next && String(next).length < 120 && !looksLikeInstitution(next)) {
        entry.degree = String(next).trim().slice(0, 120);
      }
      return entry.degree || entry.school ? entry : null;
    }

    return null;
  };

  const out = [];
  const consumed = new Set();

  for (let i = 0; i < rawLines.length && out.length < 6; i++) {
    if (consumed.has(i)) continue;
    const line = rawLines[i];
    const prev = i > 0 ? rawLines[i - 1] : "";
    const next = i + 1 < rawLines.length ? rawLines[i + 1] : "";

    const e = parseEducationLine(line, prev, next);
    if (e && (e.school || e.degree)) {
      if (!e.gpa && next && /^(?:cgpa|gpa)\b/i.test(String(next).trim())) {
        const gOnly = parseGpaFromText(next);
        if (gOnly) e.gpa = gOnly;
      }
      out.push(e);
      if (looksLikeInstitution(line) && next && degreeRe.test(String(next))) consumed.add(i + 1);
    }
  }

  if (out.length === 0) {
    for (const blob of extractEducation(text)) {
      const e = parseEducationLine(blob, "", "");
      if (e && (e.school || e.degree)) {
        out.push(e);
        if (out.length >= 4) break;
      }
    }
  }

  const seen = new Set();
  return out.filter((e) => {
    const k = `${(e.school || "").toLowerCase()}|${(e.degree || "").toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function sliceBetweenHeadings(lines, startHeadings, stopHeadings) {
  const starts = startHeadings.map((h) => String(h).trim().toLowerCase());
  const stops = (stopHeadings || []).map((h) => String(h).trim().toLowerCase());
  const lower = lines.map((l) => String(l || "").trim().toLowerCase());

  const isHeadingLine = (line, heading) => {
    if (!line) return false;
    // strict: only match when the whole line is the heading (optionally with punctuation),
    // avoids matching summary text like "experienced in..." as an "experience" heading.
    if (line === heading) return true;
    if (line === `${heading}:`) return true;
    if (line === `${heading} -`) return true;
    if (line === `${heading} —`) return true;
    if (line === `${heading} –`) return true;
    if (line.startsWith(`${heading}:`)) return true;
    return false;
  };

  let startIdx = -1;
  for (let i = 0; i < lower.length; i++) {
    const t = lower[i];
    if (starts.some((s) => isHeadingLine(t, s))) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx < 0) return null;

  let endIdx = lower.length;
  for (let i = startIdx; i < lower.length; i++) {
    const t = lower[i];
    if (stops.some((s) => isHeadingLine(t, s))) {
      endIdx = i;
      break;
    }
  }
  const sliced = lines.slice(startIdx, endIdx).filter(Boolean);
  return sliced.length ? sliced : null;
}

function parseMonthYear(value) {
  const v = String(value || "").trim().toLowerCase();
  if (/present|current|now/.test(v)) return { month: null, year: null };

  // Support MM/YYYY or M/YYYY.
  const slash = v.match(/\b(0?[1-9]|1[0-2])\s*\/\s*((?:19|20)\d{2})\b/);
  if (slash) {
    return { month: parseInt(slash[1], 10), year: parseInt(slash[2], 10) };
  }

  // Support "Feb'25" / "Feb 25" shorthand.
  const shortYear = v.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s*'?\s*(\d{2})\b/
  );
  if (shortYear) {
    const month = monthToNumber(shortYear[1]);
    const year = 2000 + parseInt(shortYear[2], 10);
    return { month, year };
  }
  const m = v.match(
    /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/
  );
  const y = v.match(/\b(19\d{2}|20\d{2})\b/);
  const month = m ? monthToNumber(m[1]) : null;
  const year = y ? parseInt(y[1]) : null;
  return { month, year };
}

function monthToNumber(month) {
  const map = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  return map[month] || null;
}

module.exports = { extractStructuredResume, COMMON_SKILLS, SKILL_DISPLAY };
