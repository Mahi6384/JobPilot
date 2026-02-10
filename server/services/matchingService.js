const Job = require("../models/jobModel");
const User = require("../models/userModel");
function calculateMatchScore(user, job) {
  let score = 0;

  // --- 1. Skills overlap (0-40 points) ---
  if (user.skills && user.skills.length > 0 && job.skills && job.skills.length > 0) {
    const userSkills = user.skills.map((s) => s.toLowerCase().trim());
    const jobSkills = job.skills.map((s) => s.toLowerCase().trim());
    const overlap = jobSkills.filter((s) => userSkills.includes(s)).length;
    const ratio = overlap / jobSkills.length; // what % of job skills does user have
    score += Math.round(ratio * 40);
  }

  // --- 2. Location match (0-20 points) ---
  if (user.preferredLocations && user.preferredLocations.length > 0 && job.location) {
    const preferred = user.preferredLocations.map((l) => l.toLowerCase().trim());
    const jobLoc = job.location.toLowerCase().trim();
    if (preferred.includes(jobLoc)) {
      score += 20;
    }
    // If user prefers remote and job is remote, give full location points
    if (job.jobType === "remote") {
      score += 20;
    }
  }

  // --- 3. Experience level match (0-20 points) ---
  if (user.yearsOfExperience != null) {
    const exp = user.yearsOfExperience;
    if (exp >= job.experienceMin && exp <= job.experienceMax) {
      score += 20; // perfect fit
    } else if (exp >= job.experienceMin - 1 && exp <= job.experienceMax + 1) {
      score += 10; // close fit
    }
  }

  // --- 4. Salary range match (0-10 points) ---
  if (user.expectedLPA != null && job.salaryMax > 0) {
    if (user.expectedLPA >= job.salaryMin && user.expectedLPA <= job.salaryMax) {
      score += 10; // within range
    } else if (user.expectedLPA <= job.salaryMax * 1.2) {
      score += 5; // slightly above
    }
  }

  // --- 5. Job type preference match (0-10 points) ---
  if (user.jobType && job.jobType) {
    // Map user's jobType to the job's jobType values
    const typeMap = {
      "full-time": ["onsite", "hybrid"],
      remote: ["remote"],
      hybrid: ["hybrid"],
      contract: ["remote", "hybrid", "onsite"], // contract can be anything
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
  // 1. Get the user
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  // 2. Build MongoDB query from filters
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

  // 3. Fetch ALL matching jobs (we score in-memory)
  const jobs = await Job.find(query).lean();

  // 4. Score each job
  const scoredJobs = jobs.map((job) => ({
    ...job,
    matchScore: calculateMatchScore(user, job),
  }));

  // 5. Sort by score descending
  scoredJobs.sort((a, b) => b.matchScore - a.matchScore);

  // 6. Paginate
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
