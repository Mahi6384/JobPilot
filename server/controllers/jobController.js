const Job = require("../models/jobModel");
const jobScrapper = require("../scrapper/jobScrapper");

const storeScrapedJobs = async (req, res) => {
  try {
    const scrapedJobs = await jobScrapper();
    console.log("Scraped Jobs:", scrapedJobs);
    if (!scrapedJobs || scrapedJobs.length === 0) {
      return res.status(404).json({ message: "No jobs found to store." });
    }

    const savedJobs = await Job.insertMany(scrapedJobs);

    res.status(201).json({
      message: "Jobs successfully stored in the database.",
      data: savedJobs,
    });
  } catch (error) {
    console.error("Error storing scraped jobs:", error);
    res
      .status(500)
      .json({ message: "Failed to store jobs.", error: error.message });
  }
};

const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find();

    if (!jobs || jobs.length === 0) {
      return res.status(404).json({ message: "No jobs found." });
    }

    res.status(200).json({
      message: "Jobs retrieved successfully.",
      data: jobs,
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch jobs.", error: error.message });
  }
};
module.exports = {
  storeScrapedJobs,
  getAllJobs,
};
