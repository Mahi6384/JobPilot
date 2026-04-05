const Application = require("../models/applicationModel");
const Job = require("../models/jobModel");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

// Valid state transitions — the only moves the system allows
const VALID_TRANSITIONS = {
  queued: ["in_progress", "skipped", "failed"],
  in_progress: ["applied", "failed", "skipped", "queued"],
  failed: ["queued", "in_progress"],
  skipped: ["queued"],
  // applied is terminal — no transitions out
};

function isValidTransition(from, to) {
  if (from === "applied") return false;
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

exports.createBatchApplications = async (req, res) => {
  try {
    const { jobIds } = req.body;
    const userId = req.user._id;

    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of job IDs",
      });
    }

    const jobs = await Job.find({ _id: { $in: jobIds } });
    if (jobs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching jobs found",
      });
    }

    const existingApps = await Application.find({
      userId,
      jobId: { $in: jobIds },
    }).select("jobId");

    const existingJobIds = new Set(
      existingApps.map((app) => app.jobId.toString())
    );

    const newJobIds = jobIds.filter(
      (id) => !existingJobIds.has(id.toString())
    );

    if (newJobIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "All selected jobs are already in your queue",
        data: { queued: 0, alreadyExists: jobIds.length },
      });
    }

    const applications = newJobIds.map((jobId) => {
      const job = jobs.find((j) => j._id.toString() === jobId.toString());
      return {
        userId,
        jobId,
        status: "queued",
        platform: job?.platform || "other",
        attempts: 0,
        statusLog: [
          {
            from: null,
            to: "queued",
            reason: "Batch queued by user",
            source: "user",
          },
        ],
      };
    });

    const result = await Application.insertMany(applications);

    const skipped = jobIds.length - newJobIds.length;
    res.status(201).json({
      success: true,
      message: `${result.length} jobs queued${skipped > 0 ? ` (${skipped} already in queue)` : ""}`,
      data: { queued: result.length, alreadyExists: skipped },
    });
  } catch (error) {
    logger.error("Error creating batch applications:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating applications",
      error: error.message,
    });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 10,
      status,
      platform,
      startDate,
      endDate,
    } = req.query;

    const filter = { userId };

    if (status) {
      filter.status = status.includes(",")
        ? { $in: status.split(",").map((s) => s.trim()) }
        : status;
    }
    if (platform) filter.platform = platform;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const applications = await Application.find(filter)
      .populate(
        "jobId",
        "title company location salary platform applicationUrl applyType easyApply"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Application.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: applications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalApplications: total,
        hasMore: skip + applications.length < total,
      },
    });
  } catch (error) {
    logger.error("Error fetching applications:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching applications",
      error: error.message,
    });
  }
};

exports.getApplicationStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [statsByStatus, appliedToday] = await Promise.all([
      Application.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Application.countDocuments({
        userId,
        status: "applied",
        appliedAt: { $gte: todayStart },
      }),
    ]);

    const stats = {
      queued: 0,
      in_progress: 0,
      applied: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      appliedToday,
    };

    statsByStatus.forEach((s) => {
      stats[s._id] = s.count;
      stats.total += s.count;
    });

    stats.successRate =
      stats.total > 0 ? Math.round((stats.applied / stats.total) * 100) : 0;

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    logger.error("Error fetching application stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching stats",
      error: error.message,
    });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, errorMessage, coverLetter, resumeUrlUsed, reason, source } =
      req.body;
    const userId = req.user._id;

    const validStatuses = [
      "queued",
      "in_progress",
      "applied",
      "failed",
      "skipped",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status: "${status}". Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const application = await Application.findOne({ _id: id, userId });
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const currentStatus = application.status;

    // STATUS LOCK: once applied, it stays applied
    if (currentStatus === "applied") {
      return res.status(200).json({
        success: true,
        message: "Application already marked as applied — status locked",
        data: application,
        locked: true,
      });
    }

    // Validate transition
    if (!isValidTransition(currentStatus, status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid transition: ${currentStatus} → ${status}`,
      });
    }

    application.status = status;

    if (status === "applied") {
      application.appliedAt = new Date();
      application.errorMessage = null;
    }

    if (errorMessage) application.errorMessage = errorMessage;
    if (coverLetter) application.coverLetter = coverLetter;
    if (resumeUrlUsed) application.resumeUrlUsed = resumeUrlUsed;

    application.attempts += 1;

    application.statusLog.push({
      from: currentStatus,
      to: status,
      reason: reason || errorMessage || `Status updated to ${status}`,
      source: source || "extension",
    });

    await application.save();

    res.status(200).json({
      success: true,
      message: `Status updated: ${currentStatus} → ${status}`,
      data: application,
    });
  } catch (error) {
    logger.error("Error updating application status:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating application",
      error: error.message,
    });
  }
};

exports.retryApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const application = await Application.findOne({ _id: id, userId });
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    if (application.status === "applied") {
      return res.status(400).json({
        success: false,
        message: "Cannot retry — already applied successfully",
      });
    }

    if (!["failed", "skipped"].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot retry from status: ${application.status}`,
      });
    }

    const previousStatus = application.status;
    application.status = "queued";
    application.errorMessage = null;
    application.statusLog.push({
      from: previousStatus,
      to: "queued",
      reason: "Retry requested by user",
      source: "user",
    });

    await application.save();

    res.status(200).json({
      success: true,
      message: "Application re-queued for retry",
      data: application,
    });
  } catch (error) {
    logger.error("Error retrying application:", error);
    res.status(500).json({
      success: false,
      message: "Server error while retrying application",
      error: error.message,
    });
  }
};
