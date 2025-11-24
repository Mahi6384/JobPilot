const mongoose = require("mongoose");

const appliedJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "jobCard",
      required: true,
    },
    status: {
      type: String,
      enum: ["applied", "failed", "pending"],
      default: "pending",
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    errorMessage: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
appliedJobSchema.index({ userId: 1, appliedAt: -1 });

const AppliedJob = mongoose.model("AppliedJob", appliedJobSchema);
module.exports = AppliedJob;
