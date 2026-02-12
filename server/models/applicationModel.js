const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "in_progress", "applied", "failed", "review_needed"],
      default: "queued",
      required: true,
    },
    appliedAt: {
      type: Date,
      default: null,
    },
    coverLetter: {
      type: String,
      default: null,
    },

    errorMessage: {
      type: String,
      default: null,
    },

    platform: {
      type: String,
      required: true,
      enum: ["LinkedIn", "Indeed", "Naukri", "AngelList", "Other"],
    },

    resumeUrlUsed: {
      type: String,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });
module.exports = mongoose.model("Application", applicationSchema);
