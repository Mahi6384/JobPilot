const mongoose = require("mongoose");
const User = require("../models/userModel");
const Job = require("../models/jobModel");
const Application = require("../models/applicationModel");
const logger = require("../utils/logger");

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

