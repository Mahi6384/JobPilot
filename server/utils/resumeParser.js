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
 * @returns {{ name, email, phone, skills, experience, education, expectedSalary, currentCtc }}
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
    /\b(?:B\.?Tech|B\.?E\.?|B\.?Sc|B\.?S\.?|M\.?Tech|M\.?S\.?|M\.?Sc|M\.?B\.?A|Ph\.?D|Bachelor|Master|Doctorate)\b[^.\n]{0,80}/gi,
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

module.exports = { extractStructuredResume, COMMON_SKILLS, SKILL_DISPLAY };
