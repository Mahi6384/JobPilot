const mongoose = require("mongoose");

const statusLogSchema = new mongoose.Schema(
  {
    from: String,
    to: String,
    reason: String,
    source: {
      type: String,
      enum: ["extension", "backend", "user", "system"],
      default: "extension",
    },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
      enum: ["queued", "in_progress", "applied", "failed", "skipped"],
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
      enum: ["linkedin", "indeed", "naukri", "angellist", "other"],
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
    statusLog: [statusLogSchema],
  },
  {
    timestamps: true,
  }
);

applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });
applicationSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("Application", applicationSchema);
