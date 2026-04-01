require("dotenv").config();

module.exports = {
  searchQueries: ["Devops Engineer", "Data Scientist", "Data Analyst"],
  // Naukri settings
  maxPagesPerQuery: 3,
  maxJobsPerQuery: 10,
  maxTotalJobs: 100,
  headless: process.env.CI === "true" || process.env.HEADLESS === "true",
  delayBetweenPages: 3000,
  jobMaxAgeDays: 30,
  // LinkedIn / JSearch settings
  linkedinMaxJobsPerQuery: 15,
  linkedinDatePosted: "week",
  jsearchApiKey: process.env.JSEARCH_API_KEY || "",
  // Scheduling
  minHoursBetweenScrapes: 18,
};
