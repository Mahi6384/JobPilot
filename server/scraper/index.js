const mongoose = require("mongoose");
const { chromium } = require("playwright");
const config = require("./config");
const { scrapeQuery: scrapeNaukriQuery } = require("./naukriScraper");
const { scrapeQuery: fetchLinkedinJobs } = require("./linkedinFetcher");
const { transformJobs, transformLinkedinJobs } = require("./transformer");
const { filterNewJobs, cleanupOldJobs } = require("./deduplicator");
const Job = require("../models/jobModel");
const ScrapeQuery = require("../models/scrapeQueryModel");
require("dotenv").config();
require("../models/applicationModel");

// Parse which platforms to scrape from command line args
function getPlatforms() {
  const args = process.argv.slice(2);
  if (args.includes("--naukri-only")) return ["naukri"];
  if (args.includes("--linkedin-only")) return ["linkedin"];
  return ["naukri", "linkedin"]; // default: both
}

// Smart throttle: check if we scraped recently
async function shouldSkipScrape() {
  if (process.argv.includes("--force")) return false;

  const lastJob = await Job.findOne().sort({ scrapedAt: -1 });
  if (!lastJob?.scrapedAt) return false;

  const hoursSinceLast = (Date.now() - lastJob.scrapedAt.getTime()) / 3600000;
  if (hoursSinceLast < config.minHoursBetweenScrapes) {
    console.log(
      `⏭️  Last scrape was ${hoursSinceLast.toFixed(1)}h ago (threshold: ${config.minHoursBetweenScrapes}h). Skipping.`,
    );
    return true;
  }

  return false;
}

async function runScraper() {
  const platforms = getPlatforms();
  let browser;

  try {
    console.log("🚀 Starting JobPilot Scraper\n");
    console.log(`📡 Platforms: ${platforms.join(", ")}\n`);

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Smart throttle check (skip if called from GitHub Actions and scraped recently)
    if (await shouldSkipScrape()) {
      return;
    }

    console.log("🧹 Cleaning up old jobs...");
    await cleanupOldJobs();

    // Merge static config queries with dynamic user-driven queries
    const dynamicQueries = await ScrapeQuery.find().distinct("query");
    const staticQueries = config.searchQueries.map((q) =>
      q.toLowerCase().trim(),
    );
    const allQueries = [...new Set([...staticQueries, ...dynamicQueries])];
    console.log(
      `\n📋 Queries: ${staticQueries.length} static + ${dynamicQueries.length} dynamic = ${allQueries.length} total\n`,
    );

    // Launch browser only if scraping Naukri
    if (platforms.includes("naukri")) {
      browser = await chromium.launch({ headless: config.headless });
      console.log(`\n🌐 Browser launched (headless: ${config.headless})\n`);
    }

    let totalNewJobs = 0;
    const summary = [];

    for (const query of allQueries) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🔎 Searching: "${query}"`);
      console.log(`${"=".repeat(60)}`);

      let naukriRaw = [];
      let linkedinRaw = [];

      // --- Naukri Scraping ---
      if (platforms.includes("naukri") && browser) {
        try {
          naukriRaw = await scrapeNaukriQuery(browser, query);
          console.log(`\n   📦 Naukri: Scraped ${naukriRaw.length} direct-apply jobs`);
        } catch (err) {
          console.log(`   ❌ Naukri scrape failed: ${err.message}`);
        }
      }

      // --- LinkedIn Fetching (JSearch API) ---
      if (platforms.includes("linkedin")) {
        try {
          linkedinRaw = await fetchLinkedinJobs(query);
          console.log(`   📦 LinkedIn: Fetched ${linkedinRaw.length} Easy Apply jobs`);
        } catch (err) {
          console.log(`   ❌ LinkedIn fetch failed: ${err.message}`);
        }
      }

      // Update lastScrapedAt for dynamic queries
      await ScrapeQuery.findOneAndUpdate(
        { query: query.toLowerCase().trim() },
        { lastScrapedAt: new Date() },
      );

      // Transform both sets
      const transformedNaukri =
        naukriRaw.length > 0 ? transformJobs(naukriRaw) : [];
      const transformedLinkedin =
        linkedinRaw.length > 0 ? transformLinkedinJobs(linkedinRaw) : [];
      const allTransformed = [...transformedNaukri, ...transformedLinkedin];

      if (allTransformed.length === 0) {
        summary.push({
          query,
          naukri: { scraped: 0, new: 0 },
          linkedin: { scraped: 0, new: 0 },
          saved: 0,
        });
        continue;
      }

      const newJobs = await filterNewJobs(allTransformed);

      if (newJobs.length === 0) {
        console.log("   ⏭️  All jobs already exist, skipping");
        summary.push({
          query,
          naukri: { scraped: naukriRaw.length, new: 0 },
          linkedin: { scraped: linkedinRaw.length, new: 0 },
          saved: 0,
        });
        continue;
      }

      const inserted = await Job.insertMany(newJobs);
      console.log(`   💾 Saved ${inserted.length} new jobs`);

      totalNewJobs += inserted.length;

      const naukriNew = newJobs.filter((j) => j.platform === "naukri").length;
      const linkedinNew = newJobs.filter(
        (j) => j.platform === "linkedin",
      ).length;

      summary.push({
        query,
        naukri: { scraped: naukriRaw.length, new: naukriNew },
        linkedin: { scraped: linkedinRaw.length, new: linkedinNew },
        saved: inserted.length,
      });

      if (totalNewJobs >= config.maxTotalJobs) {
        console.log(
          `\n🛑 Reached max total (${config.maxTotalJobs}), stopping`,
        );
        break;
      }
    }

    // --- Summary ---
    console.log(`\n${"=".repeat(60)}`);
    console.log("📊 SCRAPING SUMMARY");
    console.log(`${"=".repeat(60)}\n`);

    summary.forEach((s) => {
      console.log(`   "${s.query}"`);
      console.log(
        `      Naukri:   Scraped: ${s.naukri.scraped} | New: ${s.naukri.new}`,
      );
      console.log(
        `      LinkedIn: Scraped: ${s.linkedin.scraped} | New: ${s.linkedin.new}`,
      );
      console.log(`      Saved: ${s.saved}`);
    });

    const totalNaukri = await Job.countDocuments({ platform: "naukri" });
    const totalLinkedin = await Job.countDocuments({ platform: "linkedin" });
    console.log(`\n   📈 Total new jobs added: ${totalNewJobs}`);
    console.log(`   📊 Total Naukri jobs in DB: ${totalNaukri}`);
    console.log(`   📊 Total LinkedIn jobs in DB: ${totalLinkedin}`);

    // --- Classification Worker Phase ---
    if (platforms.includes("linkedin")) {
      console.log(`\n${"=".repeat(60)}`);
      console.log("🚦 RUNNING CLASSIFICATION WORKER");
      console.log(`${"=".repeat(60)}\n`);
      const { processLinkedInJobs } = require("../workers/linkedinClassifier");
      await processLinkedInJobs();
    }

    console.log("\n✅ Scraping completed!\n");
  } catch (error) {
    console.error("\n❌ Scraper error:", error.message);
  } finally {
    if (browser) await browser.close();
    await mongoose.disconnect();
  }
}

// Auto-run when called directly (npm run scrape)
if (require.main === module) {
  runScraper()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runScraper };
