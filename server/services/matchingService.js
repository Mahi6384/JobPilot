const Job = require("../models/jobModel");
const User = require("../models/userModel");
const Application = require("../models/applicationModel");
function calculateMatchScore(user, job) {
  let score = 0;

  if (user.skills && user.skills.length > 0 && job.skills && job.skills.length > 0) {
    const userSkills = user.skills.map((s) => s.toLowerCase().trim());
    const jobSkills = job.skills.map((s) => s.toLowerCase().trim());
    const overlap = jobSkills.filter((s) => userSkills.includes(s)).length;
    const ratio = overlap / jobSkills.length;
    score += Math.round(ratio * 40);
  }

  if (user.preferredLocations && user.preferredLocations.length > 0 && job.location) {
    const preferred = user.preferredLocations.map((l) => l.toLowerCase().trim());
    const jobLoc = job.location.toLowerCase().trim();
    if (preferred.includes(jobLoc)) {
      score += 20;
    }
    if (job.jobType === "remote") {
      score += 20;
    }
  }

  if (user.yearsOfExperience != null) {
    const exp = user.yearsOfExperience;
    if (exp >= job.experienceMin && exp <= job.experienceMax) {
      score += 20;
    } else if (exp >= job.experienceMin - 1 && exp <= job.experienceMax + 1) {
      score += 10;
    }
  }

  if (user.expectedLPA != null && job.salaryMax > 0) {
    if (user.expectedLPA >= job.salaryMin && user.expectedLPA <= job.salaryMax) {
      score += 10;
    } else if (user.expectedLPA <= job.salaryMax * 1.2) {
      score += 5;
    }
  }

  if (user.jobType && job.jobType) {
    const typeMap = {
      "full-time": ["onsite", "hybrid"],
      remote: ["remote"],
      hybrid: ["hybrid"],
      contract: ["remote", "hybrid", "onsite"],
    };
    const acceptableTypes = typeMap[user.jobType] || [];
    if (acceptableTypes.includes(job.jobType)) {
      score += 10;
    }
  }

  return score;
}

/**
 * Get matched jobs for a user, with optional filters, sorted by score
 */
async function getMatchedJobs(userId, filters = {}, page = 1, limit = 10) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const query = {};

  if (filters.platform) {
    query.platform = { $in: Array.isArray(filters.platform) ? filters.platform : [filters.platform] };
  }
  if (filters.jobType) {
    query.jobType = filters.jobType;
  }
  if (filters.location) {
    query.location = { $regex: filters.location, $options: "i" };
  }
  if (filters.experienceMin != null) {
    query.experienceMax = { $gte: Number(filters.experienceMin) };
  }
  if (filters.experienceMax != null) {
    query.experienceMin = { $lte: Number(filters.experienceMax) };
  }
  if (filters.salaryMin != null) {
    query.salaryMax = { $gte: Number(filters.salaryMin) };
  }
  if (filters.salaryMax != null) {
    query.salaryMin = { $lte: Number(filters.salaryMax) };
  }

  const existingApps = await Application.find({ userId: user._id }).select("jobId");
  const appliedJobIds = existingApps.map(app => app.jobId);
  
  if (appliedJobIds.length > 0) {
    query._id = { $nin: appliedJobIds };
  }

  const jobs = await Job.find(query).lean();

  const scoredJobs = jobs.map((job) => ({
    ...job,
    matchScore: calculateMatchScore(user, job),
  }));

  scoredJobs.sort((a, b) => b.matchScore - a.matchScore);

  const total = scoredJobs.length;
  const start = (page - 1) * limit;
  const paginated = scoredJobs.slice(start, start + limit);

  return {
    jobs: paginated,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { getMatchedJobs, calculateMatchScore };
