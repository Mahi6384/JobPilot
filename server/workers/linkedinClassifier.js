const { chromium } = require("playwright");
const Job = require("../models/jobModel");
const fs = require("fs");
const path = require("path");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay() {
  // 4–6 sec delay
  return Math.floor(Math.random() * (6000 - 4000 + 1) + 4000);
}

async function processLinkedInJobs() {
  console.log("🚦 Starting LinkedIn Job Classification Worker...");

  const jobs = await Job.find({ status: "new", platform: "linkedin" }).limit(50);
  
  if (jobs.length === 0) {
    console.log("✅ No new LinkedIn jobs to classify.");
    return;
  }

  console.log(`🔍 Found ${jobs.length} jobs to classify.`);

  const sessionPath = path.join(__dirname, "../scraper/linkedin-session.json");
  let contextOptions = {};
  
  if (fs.existsSync(sessionPath)) {
    console.log("🔐 Using saved LinkedIn session.");
    contextOptions.storageState = sessionPath;
  } else {
    console.log("⚠️ No saved LinkedIn session found at " + sessionPath);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  let count = 0;

  for (const job of jobs) {
    try {
      count++;
      console.log(`\n[${count}/${jobs.length}] Processing: ${job.applicationUrl}`);
      
      // 1. Set status = "processing"
      job.status = "processing";
      await job.save();

      // 2. Open jobUrl
      await page.goto(job.applicationUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

      // 3. Detect "Easy Apply"
      let isEasyApply = false;
      try {
        await page.waitForTimeout(2000); // Allow time for elements to render

        const easyApplyLoc = page.locator('button:has-text("Easy Apply"), button.jobs-apply-button:has-text("Easy"), span.artdeco-button__text:has-text("Easy Apply")');
        if ((await easyApplyLoc.count()) > 0) {
          isEasyApply = true;
        }
      } catch (e) {
        console.log(`   ⚠️ Could not detect button: ${e.message}`);
      }

      // 4. Update
      job.applyType = isEasyApply ? "easy_apply" : "company_site";
      job.easyApply = isEasyApply; // also update the older boolean field
      job.status = "done";
      job.classifiedAt = new Date();
      await job.save();

      console.log(`   ✅ Classified as: ${job.applyType}`);

    } catch (err) {
      console.log(`   ❌ Error processing job: ${err.message}`);
      job.status = "failed";
      job.retryCount = (job.retryCount || 0) + 1;
      await job.save();
    }

    // 5. Add Human-like Delays
    if (count < jobs.length) {
      if (count % 10 === 0) {
        console.log("   ⏳ Taking a 20 sec pause...");
        await sleep(20000); // 20 sec pause
      } else {
        const delay = getRandomDelay();
        console.log(`   ⏳ Delaying for ${Math.round(delay/1000)}s...`);
        await sleep(delay); // 4-6 sec delay
      }
    }
  }

  await browser.close();
  console.log("\n🏁 Classification Worker Finished.");
}

module.exports = { processLinkedInJobs };
