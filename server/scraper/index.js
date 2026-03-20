const mongoose = require("mongoose");
const { chromium } = require("playwright");
const config = require("./config");
const { scrapeQuery } = require("./naukriScraper");
const { transformJobs } = require("./transformer");
const { filterNewJobs, cleanupOldJobs } = require("./deduplicator");
const Job = require("../models/jobModel");
require("dotenv").config();
require("../models/applicationModel");

async function runScraper() {
  let browser;

  try {
    console.log("🚀 Starting JobPilot Scraper\n");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("🧹 Cleaning up old jobs...");
    await cleanupOldJobs();

    browser = await chromium.launch({ headless: config.headless });
    console.log(`\n🌐 Browser launched (headless: ${config.headless})\n`);

    let totalNewJobs = 0;
    const summary = [];

    for (const query of config.searchQueries) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🔎 Searching: "${query}"`);
      console.log(`${"=".repeat(60)}`);

      const rawJobs = await scrapeQuery(browser, query);
      console.log(`\n   📦 Scraped ${rawJobs.length} direct-apply jobs`);

      if (rawJobs.length === 0) {
        summary.push({ query, scraped: 0, new: 0, saved: 0 });
        continue;
      }

      const transformedJobs = transformJobs(rawJobs);
      const newJobs = await filterNewJobs(transformedJobs);

      if (newJobs.length === 0) {
        console.log("   ⏭️  All jobs already exist, skipping");
        summary.push({ query, scraped: rawJobs.length, new: 0, saved: 0 });
        continue;
      }

      const inserted = await Job.insertMany(newJobs);
      console.log(`   💾 Saved ${inserted.length} new jobs`);

      totalNewJobs += inserted.length;
      summary.push({
        query,
        scraped: rawJobs.length,
        new: newJobs.length,
        saved: inserted.length,
      });

      if (totalNewJobs >= config.maxTotalJobs) {
        console.log(
          `\n🛑 Reached max total (${config.maxTotalJobs}), stopping`,
        );
        break;
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("📊 SCRAPING SUMMARY");
    console.log(`${"=".repeat(60)}\n`);

    summary.forEach((s) => {
      console.log(
        `   "${s.query}" → Scraped: ${s.scraped} | New: ${s.new} | Saved: ${s.saved}`,
      );
    });

    const totalInDb = await Job.countDocuments({ platform: "naukri" });
    console.log(`\n   📈 Total new jobs added: ${totalNewJobs}`);
    console.log(`   📊 Total Naukri jobs in DB: ${totalInDb}`);
    console.log("\n✅ Scraping completed!\n");
  } catch (error) {
    console.error("\n❌ Scraper error:", error.message);
  } finally {
    if (browser) await browser.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runScraper();
