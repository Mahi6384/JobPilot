// server/controllers/applicationController.js
const Application = require("../models/applicationModel");
const Job = require("../models/jobModel");
const mongoose = require("mongoose");

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
        if (jobs.length !== jobIds.length) {
            return res.status(404).json({
                success: false,
                message: "One or more jobs not found",
            });
        }

        const applications = jobIds.map((jobId) => ({
            userId,
            jobId,
            status: "queued",
            platform:
                jobs.find((j) => j._id.toString() === jobId.toString())
                    ?.platform || "Other",
            attempts: 0,
        }));

        const result = await Application.insertMany(applications, {
            ordered: false,
        }).catch((error) => {
            if (error.code === 11000) {
                return { insertedCount: 0 };
            }
            throw error;
        });

        res.status(201).json({
            success: true,
            message: `${applications.length} applications queued successfully`,
            data: result,
        });
    } catch (error) {
        console.error("Error creating batch applications:", error);
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
            filter.status = status;
        }

        if (platform) {
            filter.platform = platform;
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                filter.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.createdAt.$lte = new Date(endDate);
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const applications = await Application.find(filter)
            .populate("jobId", "title company location salary platform")
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
        console.error("Error fetching applications:", error);
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
        const stats = await Application.aggregate([
            { $match: { userId: mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
        ]);
        const statsObject = {
            queued: 0,
            in_progress: 0,
            applied: 0,
            failed: 0,
            review_needed: 0,
            total: 0,
        };

        stats.forEach((stat) => {
            statsObject[stat._id] = stat.count;
            statsObject.total += stat.count;
        });

        res.status(200).json({
            success: true,
            data: statsObject,
        });
    } catch (error) {
        console.error("Error fetching application stats:", error);
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
        const { status, errorMessage, coverLetter, resumeUrlUsed } = req.body;
        const userId = req.user._id;

        const validStatuses = [
            "queued",
            "in_progress",
            "applied",
            "failed",
            "review_needed",
        ];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value",
            });
        }
        const application = await Application.findOne({ _id: id, userId });
        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found",
            });
        }
        application.status = status;

        if (status === "applied") {
            application.appliedAt = new Date();
        }

        if (errorMessage) {
            application.errorMessage = errorMessage;
        }

        if (coverLetter) {
            application.coverLetter = coverLetter;
        }

        if (resumeUrlUsed) {
            application.resumeUrlUsed = resumeUrlUsed;
        }
        application.attempts += 1;

        await application.save();

        res.status(200).json({
            success: true,
            message: "Application status updated successfully",
            data: application,
        });
    } catch (error) {
        console.error("Error updating application status:", error);
        res.status(500).json({
            success: false,
            message: "Server error while updating application",
            error: error.message,
        });
    }
};
