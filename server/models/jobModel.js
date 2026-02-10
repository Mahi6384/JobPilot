const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, required: true },
    jobType: {
      type: String,
      enum: ["remote", "hybrid", "onsite"],
      required: true,
    },
    experienceMin: { type: Number, default: 0 },
    experienceMax: { type: Number, default: 0 },
    salaryMin: { type: Number, default: 0 }, 
    salaryMax: { type: Number, default: 0 },
    skills: [{ type: String }],
    description: { type: String },
    platform: {
      type: String,
      enum: ["linkedin", "naukri", "indeed"],
      required: true,
    },
    applicationUrl: { type: String, required: true },
    easyApply: { type: Boolean, default: false },
    postedDate: { type: Date },
    scrapedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

jobSchema.index({ skills: 1 });
jobSchema.index({ location: 1 });
jobSchema.index({ jobType: 1 });
jobSchema.index({ platform: 1 });

const Job = mongoose.model("Job", jobSchema);
module.exports = Job;
