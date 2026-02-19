const mongoose = require("mongoose");
const Job = require("../models/jobModel");
require("dotenv").config();

const checkJobs = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const count = await Job.countDocuments({ platform: "naukri" });
    const jobs = await Job.find({ platform: "naukri" }).limit(5);

    console.log(`\n✅ Total Naukri jobs in database: ${count}\n`);
    console.log("📋 Sample jobs:\n");

    jobs.forEach((job, i) => {
      console.log(`${i + 1}. ${job.title}`);
      console.log(`   Company: ${job.company}`);
      console.log(`   Location: ${job.location}`);
      console.log(`   Skills: ${job.skills.join(", ")}`);
      console.log(`   URL: ${job.applicationUrl}`);
      console.log("");
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

checkJobs();
