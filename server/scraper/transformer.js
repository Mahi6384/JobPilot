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

  if (text.includes("remote") || text.includes("work from home"))
    return "remote";
  if (text.includes("hybrid")) return "hybrid";
  return "hybrid";
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

function transformJobs(rawJobs) {
  return rawJobs.map((job) => {
    const exp = parseExperience(job.experience);
    const salary = parseSalary(job.salary);

    return {
      title: job.title || "Unknown",
      company: job.company || "Unknown",
      location: job.location || "Not specified",
      jobType: detectJobType(job.location || "", job.title || ""),
      experienceMin: exp.min,
      experienceMax: exp.max,
      salaryMin: salary.min,
      salaryMax: salary.max,
      skills: cleanSkills(job.skills),
      description: `${job.title} at ${job.company}. Experience: ${job.experience || "N/A"}. Salary: ${job.salary || "Not disclosed"}`,
      platform: "naukri",
      applicationUrl: job.applicationUrl,
      easyApply: true,
      postedDate: new Date(),
      scrapedAt: new Date(),
    };
  });
}

module.exports = { transformJobs, parseExperience, parseSalary, cleanSkills };
