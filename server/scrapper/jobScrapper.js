const { chromium } = require("playwright");
const logger = require("../utils/logger");
const { createRateLimiter } = require("../utils/retry");

// Create rate limiter: max 1 request per 2 seconds
const rateLimiter = createRateLimiter(1, 2);

const scrapeJobs = async () => {
  let browser;
  try {
    logger.info("Starting job scraping from Naukri");

    // Apply rate limiting
    await rateLimiter();

    browser = await chromium.launch({
      headless: process.env.HEADLESS === "true" || false,
      timeout: 30000,
    });

    const page = await browser.newPage();

    // Set a reasonable timeout for page navigation
    page.setDefaultTimeout(30000);

    // Set user agent to avoid detection
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    logger.info("Navigating to Naukri job search page");

    // scraping from naukri (just for demo purpose)
    await page.goto(
      "https://www.naukri.com/software-engineer-jobs?k=software%20engineer",
      {
        waitUntil: "networkidle",
        timeout: 30000,
      }
    );

    logger.info("Waiting for job cards to load");
    await page.waitForSelector(".srp-jobtuple-wrapper", { timeout: 15000 });

    // Extracting job cards with URLs
    logger.info("Extracting job data from page");
    const jobs = await page.$$eval(
      ".srp-jobtuple-wrapper",
      (cards) =>
        cards
          .map((card) => {
            const titleElement = card.querySelector(".title");
            if (!titleElement) return null;

            const jobUrl = titleElement.getAttribute("href") || "";
            // Make URL absolute if it's relative
            const fullUrl =
              jobUrl && jobUrl.startsWith("http")
                ? jobUrl
                : jobUrl
                  ? `https://www.naukri.com${jobUrl}`
                  : "";

            return {
              title: titleElement.innerText?.trim() || "",
              companyName:
                card.querySelector(".comp-name")?.innerText.trim() || "",
              location: card.querySelector(".loc")?.innerText.trim() || "",
              experience:
                card.querySelector(".expwdth")?.innerText.trim() || "",
              jobUrl: fullUrl,
            };
          })
          .filter((job) => job !== null && job.title !== "") // Filter out invalid jobs
    );

    logger.info(`Successfully scraped ${jobs.length} jobs`);
    return jobs;
  } catch (error) {
    logger.error("Error during job scraping", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      logger.debug("Browser closed");
    }
  }
};

module.exports = scrapeJobs;
