const { chromium } = require("playwright");
const { scrapeQuery } = require("../scraper/naukriScraper");
const { transformJobs } = require("../scraper/transformer");
const { filterNewJobs } = require("../scraper/deduplicator");
const Job = require("../models/jobModel");
const User = require("../models/userModel");
const ScrapeQuery = require("../models/scrapeQueryModel");
const logger = require("../utils/logger");

/**
 * Run a quick on-demand scrape for a single search query.
 * Designed to be called from within the Express server (fire-and-forget).
 * Only scrapes 1 page with up to 10 jobs for speed.
 */
async function runOnDemandScrape(userId, searchTerm) {
  let browser;

  try {
    logger.info(`On-demand scrape started for "${searchTerm}" (user: ${userId})`);

    // Mark user as searching
    await User.findByIdAndUpdate(userId, { jobSearchStatus: "searching" });

    // Save query for future scheduled scrapes (upsert to avoid duplicates)
    await ScrapeQuery.findOneAndUpdate(
      { query: searchTerm.toLowerCase().trim() },
      {
        query: searchTerm.toLowerCase().trim(),
        addedBy: userId,
        source: "onboarding",
        lastScrapedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    browser = await chromium.launch({ headless: false });

    const rawJobs = await scrapeQuery(browser, searchTerm);
    logger.info(`On-demand scrape: scraped ${rawJobs.length} raw jobs for "${searchTerm}"`);

    if (rawJobs.length > 0) {
      const transformedJobs = transformJobs(rawJobs);
      const newJobs = await filterNewJobs(transformedJobs);

      if (newJobs.length > 0) {
        const inserted = await Job.insertMany(newJobs);
        logger.info(`On-demand scrape: saved ${inserted.length} new jobs for "${searchTerm}"`);
      } else {
        logger.info(`On-demand scrape: all jobs already exist for "${searchTerm}"`);
      }
    } else {
      logger.info(`On-demand scrape: no jobs found for "${searchTerm}"`);
    }

    // Mark user as ready (scraping complete)
    await User.findByIdAndUpdate(userId, { jobSearchStatus: "ready" });
    logger.info(`On-demand scrape completed for "${searchTerm}" (user: ${userId})`);
  } catch (error) {
    logger.error(`On-demand scrape failed for "${searchTerm}"`, error);
    // Still mark as ready so user isn't stuck in "searching" forever
    await User.findByIdAndUpdate(userId, { jobSearchStatus: "ready" });
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { runOnDemandScrape };
