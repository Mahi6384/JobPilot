require("dotenv").config();

// Parse comma-separated JSearch API keys for rotation
const _jsearchKeys = (
  process.env.JSEARCH_API_KEYS ||
  process.env.JSEARCH_API_KEY ||
  ""
)
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

let _keyIndex = 0;

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
  // Round-robin through all available API keys
  getJsearchApiKey() {
    if (_jsearchKeys.length === 0) return "";
    const key = _jsearchKeys[_keyIndex % _jsearchKeys.length];
    _keyIndex++;
    return key;
  },
  jsearchKeyCount: _jsearchKeys.length,
  // Scheduling
  minHoursBetweenScrapes: 18,
};
