const mongoose = require("mongoose");
const Job = require("../models/jobModel");
const Application = require("../models/applicationModel");
const User = require("../models/userModel");
require("dotenv").config();

async function queueJobs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne();
    if (!user) {
      console.log("No user found! Sign up first.");
      process.exit(1);
    }
    console.log(`Using user: ${user.email}`);

    const appliedJobIds = await Application.distinct("jobId", {
      userId: user._id,
    });

    const jobs = await Job.find({
      platform: "naukri",
      _id: { $nin: appliedJobIds },
    }).limit(5);
    console.log(`Found ${jobs.length} jobs to queue`);

    for (const job of jobs) {
      await Application.create({
        userId: user._id,
        jobId: job._id,
        status: "queued",
        platform: "naukri",
      });
      console.log(`✅ Queued: ${job.title} at ${job.company}`);
    }

    console.log("\nDone! Refresh your extension popup to see the queue.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

queueJobs();
