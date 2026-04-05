function parseExperience(expString) {
  if (!expString || expString === "Not specified") {
    return { min: 0, max: 2 };
  }
  const numbers = expString.match(/(\d+)/g);
  if (!numbers) return { min: 0, max: 2 };
  const min = parseInt(numbers[0]);
  const max = numbers[1] ? parseInt(numbers[1]) : min + 2;
  return { min, max };
}

function parseSalary(salaryString) {
  if (!salaryString || salaryString === "Not disclosed") {
    return { min: 0, max: 0 };
  }
  const numbers = salaryString.match(/(\d+\.?\d*)/g);
  if (!numbers) return { min: 0, max: 0 };
  const min = parseFloat(numbers[0]);
  const max = numbers[1] ? parseFloat(numbers[1]) : min;
  return { min, max };
}

function detectJobType(location, title) {
  const text = `${location} ${title}`.toLowerCase();
  if (text.includes("remote") || text.includes("work from home")) return "remote";
  if (text.includes("hybrid")) return "hybrid";
  return "onsite";
}

function cleanSkills(skills) {
  if (!skills || skills.length === 0) return [];

  const seen = new Map();
  skills.forEach((skill) => {
    const key = skill.toLowerCase().trim();
    if (key && key.length < 30 && !seen.has(key)) {
      seen.set(key, skill.trim());
    }
  });

  return Array.from(seen.values()).slice(0, 10);
}

/**
 * Transforms a single raw job object into the DB schema format.
 * Shared by both Naukri and LinkedIn pipelines.
 */
function transformJob(raw, platform) {
  const exp = parseExperience(raw.experience);
  const salary = parseSalary(raw.salary);

  const fallbackDescription = `${raw.title} at ${raw.company}. Experience: ${raw.experience || "N/A"}. Salary: ${raw.salary || "Not disclosed"}`;

  return {
    title: raw.title || "Unknown",
    company: raw.company || "Unknown",
    location: raw.location || "Not specified",
    jobType: detectJobType(raw.location || "", raw.title || ""),
    experienceMin: exp.min,
    experienceMax: exp.max,
    salaryMin: raw.salaryMin || salary.min,
    salaryMax: raw.salaryMax || salary.max,
    skills: cleanSkills(raw.skills),
    description: raw.description || fallbackDescription,
    platform,
    applicationUrl: raw.applicationUrl,
    easyApply: true,
    applyType: "easy_apply",
    postedDate: raw.postedDate || new Date(),
    scrapedAt: new Date(),
  };
}

function transformJobs(rawJobs) {
  return rawJobs.map((job) => transformJob(job, "naukri"));
}

function transformLinkedinJobs(rawJobs) {
  return rawJobs.map((job) => transformJob(job, "linkedin"));
}

module.exports = {
  transformJobs,
  transformLinkedinJobs,
  transformJob,
  parseExperience,
  parseSalary,
  cleanSkills,
};
