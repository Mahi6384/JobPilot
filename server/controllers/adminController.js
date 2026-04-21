const mongoose = require("mongoose");
const User = require("../models/userModel");
const Job = require("../models/jobModel");
const Application = require("../models/applicationModel");
const logger = require("../utils/logger");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

exports.getOverview = async (req, res) => {
  try {
    const now = new Date();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      usersTotal,
      usersNewLast7d,
      jobsTotal,
      jobsLast24h,
      jobsLast7d,
      jobsByPlatformAgg,
      applicationsByStatusAgg,
      failedLast24h,
      topErrorsAgg,
      lastScrapedJob,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: last7d } }),
      Job.countDocuments({}),
      Job.countDocuments({ scrapedAt: { $gte: last24h } }),
      Job.countDocuments({ scrapedAt: { $gte: last7d } }),
      Job.aggregate([
        { $group: { _id: "$platform", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Application.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Application.countDocuments({ status: "failed", updatedAt: { $gte: last24h } }),
      Application.aggregate([
        {
          $match: {
            status: "failed",
            updatedAt: { $gte: last7d },
            errorMessage: { $type: "string", $ne: "" },
          },
        },
        { $group: { _id: "$errorMessage", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Job.findOne({}, { scrapedAt: 1 }).sort({ scrapedAt: -1 }).lean(),
    ]);

    const jobsByPlatform = {};
    jobsByPlatformAgg.forEach((p) => {
      if (p?._id) jobsByPlatform[p._id] = p.count;
    });

    const applicationsByStatus = {};
    applicationsByStatusAgg.forEach((s) => {
      if (s?._id) applicationsByStatus[s._id] = s.count;
    });

    const topErrors = topErrorsAgg.map((e) => ({
      errorMessage: e._id,
      count: e.count,
    }));

    const lastRun = lastScrapedJob?.scrapedAt || null;

    return res.status(200).json({
      success: true,
      users: { total: usersTotal, newLast7d: usersNewLast7d },
      jobs: {
        total: jobsTotal,
        last24h: jobsLast24h,
        last7d: jobsLast7d,
        byPlatform: jobsByPlatform,
      },
      applications: {
        byStatus: applicationsByStatus,
        failedLast24h,
        topErrors,
      },
      scraper: {
        lastRun,
        lastSuccess: lastRun,
        lastError: null,
      },
    });
  } catch (error) {
    logger.error("Admin overview error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const {
      search,
      onboardingStatus,
      jobSearchStatus,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (onboardingStatus) filter.onboardingStatus = onboardingStatus;
    if (jobSearchStatus) filter.jobSearchStatus = jobSearchStatus;
    if (search && String(search).trim()) {
      const escaped = escapeRegex(String(search).trim());
      filter.$or = [
        { email: { $regex: escaped, $options: "i" } },
        { fullName: { $regex: escaped, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(
          "email fullName onboardingStatus jobSearchStatus isAdmin createdAt updatedAt",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    logger.error("Admin getUsers error", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id" });
    }

    const user = await User.findById(id).select("-passwordHash").lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const byStatusAgg = await Application.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const byStatus = {};
    let total = 0;
    byStatusAgg.forEach((s) => {
      byStatus[s._id] = s.count;
      total += s.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        user,
        stats: {
          applicationsTotal: total,
          applicationsByStatus: byStatus,
        },
      },
    });
  } catch (error) {
    logger.error("Admin getUserById error", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

exports.getJobs = async (req, res) => {
  try {
    const { search, platform, dateFrom, dateTo, page = 1, limit = 20 } =
      req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (platform) filter.platform = platform;

    if (dateFrom || dateTo) {
      filter.scrapedAt = {};
      if (dateFrom) filter.scrapedAt.$gte = new Date(dateFrom);
      if (dateTo) filter.scrapedAt.$lte = new Date(dateTo);
    }

    if (search && String(search).trim()) {
      const escaped = escapeRegex(String(search).trim());
      filter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { company: { $regex: escaped, $options: "i" } },
        { location: { $regex: escaped, $options: "i" } },
      ];
    }

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .select(
          "title company location platform jobType easyApply scrapedAt applicationUrl createdAt updatedAt",
        )
        .sort({ scrapedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Job.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    logger.error("Admin getJobs error", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

exports.getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid job id" });
    }

    const job = await Job.findById(id).lean();
    if (!job) {
      return res
        .status(404)
        .json({ success: false, message: "Job not found" });
    }

    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    logger.error("Admin getJobById error", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const { status, platform, userId, jobId, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (platform) filter.platform = platform;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.userId = new mongoose.Types.ObjectId(userId);
    }
    if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
      filter.jobId = new mongoose.Types.ObjectId(jobId);
    }

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .select(
          "userId jobId status platform attempts appliedAt errorMessage createdAt updatedAt",
        )
        .populate("jobId", "title company location platform applicationUrl")
        .populate("userId", "email fullName")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Application.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: applications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    logger.error("Admin getApplications error", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

exports.getApplicationFailures = async (req, res) => {
  try {
    const { sinceDays = 7, groupBy = "errorMessage" } = req.query;
    const days = Math.min(365, Math.max(1, Number(sinceDays) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const groupField =
      groupBy === "platform" ? "$platform" : "$errorMessage";

    const rows = await Application.aggregate([
      {
        $match: {
          status: "failed",
          updatedAt: { $gte: since },
          ...(groupBy === "errorMessage"
            ? { errorMessage: { $type: "string", $ne: "" } }
            : {}),
        },
      },
      { $group: { _id: groupField, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);

    return res.status(200).json({
      success: true,
      since,
      groupBy: groupBy === "platform" ? "platform" : "errorMessage",
      data: rows.map((r) => ({ key: r._id, count: r.count })),
    });
  } catch (error) {
    logger.error("Admin getApplicationFailures error", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

