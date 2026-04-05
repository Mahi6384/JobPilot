const Job = require("../models/jobModel");
const Application = require("../models/applicationModel");
const config = require("./config");
const logger = require("../utils/logger");

async function filterNewJobs(jobs) {
  const existingUrls = await Job.distinct("applicationUrl");
  const existingSet = new Set(existingUrls);

  const uniqueMap = new Map();
  for (const job of jobs) {
    if (!existingSet.has(job.applicationUrl) && !uniqueMap.has(job.applicationUrl)) {
      uniqueMap.set(job.applicationUrl, job);
    }
  }

  const newJobs = Array.from(uniqueMap.values());

  logger.info(
    `Deduplication: ${jobs.length} scraped → ${newJobs.length} new (${jobs.length - newJobs.length} duplicates)`
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
    logger.info(
      `Cleaned up ${result.deletedCount} old jobs (older than ${config.jobMaxAgeDays} days)`
    );
  } else {
    logger.info("No old jobs to clean up");
  }

  return result.deletedCount;
}

module.exports = { filterNewJobs, cleanupOldJobs };
