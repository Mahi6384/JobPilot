const Job = require("../models/jobModel");
const Application = require("../models/applicationModel");
const config = require("./config");

async function filterNewJobs(jobs) {
  const existingUrls = await Job.distinct("applicationUrl");
  const existingSet = new Set(existingUrls);

  const newJobs = jobs.filter((job) => !existingSet.has(job.applicationUrl));

  console.log(
    `   📊 ${jobs.length} scraped → ${newJobs.length} new (${jobs.length - newJobs.length} duplicates skipped)`,
  );

  return newJobs;
}

async function cleanupOldJobs() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.jobMaxAgeDays);

  const protectedJobIds = await Application.distinct("jobId");

  const result = await Job.deleteMany({
    scrapedAt: { $lt: cutoffDate },
    _id: { $nin: protectedJobIds },
  });

  if (result.deletedCount > 0) {
    console.log(
      `🗑️  Cleaned up ${result.deletedCount} old jobs (>${config.jobMaxAgeDays} days)`,
    );
  } else {
    console.log("✅ No old jobs to clean up");
  }

  return result.deletedCount;
}

module.exports = { filterNewJobs, cleanupOldJobs };
