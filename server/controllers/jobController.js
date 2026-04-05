const Job = require("../models/jobModel");
const User = require("../models/userModel");
const Application = require("../models/applicationModel");
const {
  getMatchedJobs: getMatchedJobsService,
} = require("../services/matchingService");
const logger = require("../utils/logger");

const getMatchedJobs = async (req, res) => {
  try {
    const {
      platform,
      jobType,
      location,
      experienceMin,
      experienceMax,
      salaryMin,
      salaryMax,
      page = 1,
      limit = 10,
    } = req.query;

    const filters = {};

    if (platform) filters.platform = platform.split(",");
    if (jobType) filters.jobType = jobType.split(",");
    if (location) filters.location = location;
    if (experienceMin) filters.experienceMin = experienceMin;
    if (experienceMax) filters.experienceMax = experienceMax;
    if (salaryMin) filters.salaryMin = salaryMin;
    if (salaryMax) filters.salaryMax = salaryMax;

    const result = await getMatchedJobsService(
      req.userId,
      filters,
      Number(page),
      Number(limit),
    );
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error("Error fetching matched jobs", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const getJobFilters = async (req, res) => {
  try {
    const [platforms, jobTypes, locations] = await Promise.all([
      Job.distinct("platform").exec(),
      Job.distinct("jobType").exec(),
      Job.distinct("location").exec(),
    ]);
    return res
      .status(200)
      .json({ success: true, platforms, jobTypes, locations });
  } catch (error) {
    logger.error("Error fetching job filters", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch job filters" });
  }
};

const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    logger.error("Error fetching job by id", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch job" });
  }
};

const getDashboardData = async (req, res) => {
  try {
    const topJobs = await getMatchedJobsService(req.userId, {}, 1, 5);

    const user = await User.findById(req.userId).select("targetJobTitle");
    let totalMatches = 0;
    if (user?.targetJobTitle) {
      const escaped = user.targetJobTitle.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      totalMatches = await Job.countDocuments({
        title: { $regex: escaped, $options: "i" },
      });
    }
    if (totalMatches === 0) {
      totalMatches = await Job.countDocuments({});
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [appliedToday, totalApplied, totalApplications] = await Promise.all([
      Application.countDocuments({
        userId: req.userId,
        status: "applied",
        appliedAt: { $gte: todayStart },
      }),
      Application.countDocuments({
        userId: req.userId,
        status: "applied",
      }),
      Application.countDocuments({
        userId: req.userId,
        status: { $in: ["applied", "failed", "skipped"] },
      }),
    ]);

    const successRate =
      totalApplications > 0
        ? Math.round((totalApplied / totalApplications) * 100)
        : 0;

    return res.status(200).json({
      success: true,
      stats: { totalMatches, appliedToday, successRate, totalApplied },
      topJobs: topJobs.jobs,
    });
  } catch (error) {
    logger.error("Error fetching dashboard data", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const getJobSearchStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("jobSearchStatus");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return res
      .status(200)
      .json({ success: true, jobSearchStatus: user.jobSearchStatus });
  } catch (error) {
    logger.error("Error fetching job search status", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getMatchedJobs,
  getJobFilters,
  getJobById,
  getDashboardData,
  getJobSearchStatus,
};
