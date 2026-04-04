const { chromium } = require("playwright");
const { scrapeQuery: scrapeNaukriQuery } = require("../scraper/naukriScraper");
const { scrapeQuery: scrapeLinkedinQuery } = require("../scraper/linkedinScraper");
const { transformJobs, transformLinkedinJobs } = require("../scraper/transformer");
const { filterNewJobs } = require("../scraper/deduplicator");
const Job = require("../models/jobModel");
const User = require("../models/userModel");
const ScrapeQuery = require("../models/scrapeQueryModel");
const logger = require("../utils/logger");

/**
 * Run a quick on-demand scrape for a single search query.
 * Designed to be called from within the Express server (fire-and-forget).
 * Scrapes Naukri and LinkedIn with Playwright (shared browser instance).
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

    let naukriJobs = [];
    let linkedinJobs = [];

    // Launch a single browser for both platforms
    try {
      browser = await chromium.launch({ headless: true }); // better to be headless for onDemand
      
      // --- Naukri Scraping (Playwright) ---
      try {
        const rawNaukri = await scrapeNaukriQuery(browser, searchTerm);
        logger.info(`On-demand scrape: scraped ${rawNaukri.length} Naukri jobs for "${searchTerm}"`);

        if (rawNaukri.length > 0) {
          naukriJobs = transformJobs(rawNaukri);
        }
      } catch (err) {
        logger.error(`On-demand Naukri scrape failed for "${searchTerm}"`, err);
      }

      // --- LinkedIn Scraping (Playwright) ---
      try {
        const rawLinkedin = await scrapeLinkedinQuery(browser, searchTerm);
        logger.info(`On-demand scrape: scraped ${rawLinkedin.length} LinkedIn jobs for "${searchTerm}"`);

        if (rawLinkedin.length > 0) {
          linkedinJobs = transformLinkedinJobs(rawLinkedin);
        }
      } catch (err) {
        logger.error(`On-demand LinkedIn scrape failed for "${searchTerm}"`, err);
      }
    } catch (err) {
      logger.error(`On-demand scraper failed to launch browser`, err);
    }

    // --- Merge, Dedup, Insert ---
    const allTransformed = [...naukriJobs, ...linkedinJobs];

    if (allTransformed.length > 0) {
      const newJobs = await filterNewJobs(allTransformed);

      if (newJobs.length > 0) {
        const inserted = await Job.insertMany(newJobs);
        const naukriCount = inserted.filter((j) => j.platform === "naukri").length;
        const linkedinCount = inserted.filter((j) => j.platform === "linkedin").length;
        logger.info(
          `On-demand scrape: saved ${inserted.length} new jobs (${naukriCount} Naukri, ${linkedinCount} LinkedIn) for "${searchTerm}"`
        );
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
