const mongoose = require("mongoose");

const jobCardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    experience: {
      type: String,
      default: "",
    },
    jobUrl: {
      type: String,
      required: true,
    },
    salary: {
      type: String,
      default: "",
    },
    postedDate: {
      type: String,
      default: "",
    },
    jobId: {
      type: String,
      default: "",
    },
    applyButtonSelector: {
      type: String,
      default: "",
    },
    isEasyApply: {
      type: Boolean,
      default: false,
    },
    postedAt: {
      type: Date,
      default: Date.now,
    },
    applied: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
jobCardSchema.index({ userId: 1, applied: 1, createdAt: -1 });

const jobCard = mongoose.model("jobCard", jobCardSchema);
module.exports = jobCard;
