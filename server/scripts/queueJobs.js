const mongoose = require("mongoose");
const Job = require("../models/jobModel");
const Application = require("../models/applicationModel");
const User = require("../models/userModel");
require("dotenv").config();

async function queueJobs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Get your user
    const user = await User.findOne();
    if (!user) {
      console.log("No user found! Sign up first.");
      process.exit(1);
    }
    console.log(`Using user: ${user.email}`);

    // Get 5 naukri jobs
    const jobs = await Job.find({ platform: "naukri" }).limit(5);
    console.log(`Found ${jobs.length} jobs to queue`);

    // Create applications with status "queued"
    for (const job of jobs) {
      const existing = await Application.findOne({
        userId: user._id,
        jobId: job._id,
      });
      if (existing) {
        console.log(`Already queued: ${job.title}`);
        continue;
      }

      await Application.create({
        userId: user._id,
        jobId: job._id,
        status: "queued",
        platform: "Naukri",
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
