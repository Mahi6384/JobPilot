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
  // LinkedIn (Playwright scraper, Naukri-style link harvest + job page visits)
  linkedinMaxJobsPerQuery: 15,
  /** ms to wait for first `a[href*="/jobs/view/"]` on search results */
  linkedinListLinkTimeout: 25000,
  // Scheduling
  minHoursBetweenScrapes: 18,
};
