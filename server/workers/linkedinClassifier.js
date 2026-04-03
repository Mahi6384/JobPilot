const { chromium } = require("playwright");
const Job = require("../models/jobModel");
const fs = require("fs");
const path = require("path");
const os = require("os");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay() {
  // 4–6 sec delay
  return Math.floor(Math.random() * (6000 - 4000 + 1) + 4000);
}

/**
 * Resolve the LinkedIn session storage state.
 * Priority:
 *   1. Local file: scraper/linkedin-session.json
 *   2. Env var: LINKEDIN_SESSION (base64-encoded JSON, for CI)
 * Returns the path to use for storageState, or null if none available.
 */
function resolveSessionPath() {
  const localPath = path.join(__dirname, "../scraper/linkedin-session.json");

  // 1. Local file takes priority
  if (fs.existsSync(localPath)) {
    console.log("🔐 Using local LinkedIn session file.");
    return localPath;
  }

  // 2. Decode from env var (GitHub Actions)
  const envSession = process.env.LINKEDIN_SESSION;
  if (envSession) {
    console.log("🔐 Decoding LinkedIn session from LINKEDIN_SESSION env var...");
    try {
      const decoded = Buffer.from(envSession, "base64").toString("utf-8");
      // Validate it's valid JSON
      JSON.parse(decoded);
      const tempPath = path.join(os.tmpdir(), "linkedin-session.json");
      fs.writeFileSync(tempPath, decoded, "utf-8");
      console.log(`   ✅ Session written to temp: ${tempPath}`);
      return tempPath;
    } catch (err) {
      console.log(`   ❌ Failed to decode LINKEDIN_SESSION: ${err.message}`);
    }
  }

  console.log("⚠️ No LinkedIn session found (no local file or env var).");
  console.log("   Run 'npm run save:linkedin' to create one.");
  return null;
}

async function processLinkedInJobs() {
  console.log("🚦 Starting LinkedIn Job Classification Worker...");

  // Fetch new jobs + failed jobs with retryCount < 3
  const jobs = await Job.find({
    platform: "linkedin",
    $or: [
      { status: "new" },
      { status: "failed", retryCount: { $lt: 3 } },
    ],
  }).limit(50);

  if (jobs.length === 0) {
    console.log("✅ No LinkedIn jobs to classify.");
    return;
  }

  const newCount = jobs.filter((j) => j.status === "new").length;
  const retryCount = jobs.filter((j) => j.status === "failed").length;
  console.log(
    `🔍 Found ${jobs.length} jobs to classify (${newCount} new, ${retryCount} retries).`,
  );

  const sessionPath = resolveSessionPath();
  let contextOptions = {};

  if (sessionPath) {
    contextOptions.storageState = sessionPath;
  } else {
    console.log("⚠️ Proceeding without session — LinkedIn may block access.");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...contextOptions,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  let classified = 0;
  let failed = 0;

  for (const [index, job] of jobs.entries()) {
    try {
      console.log(
        `\n[${index + 1}/${jobs.length}] Processing: ${job.title} @ ${job.company}`,
      );
      console.log(`   URL: ${job.applicationUrl}`);

      // 1. Set status = "processing"
      job.status = "processing";
      await job.save();

      // 2. Open jobUrl
      await page.goto(job.applicationUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      // 3. Detect "Easy Apply"
      let isEasyApply = false;
      try {
        await page.waitForTimeout(2000); // Allow time for elements to render

        // Check multiple selectors for Easy Apply button
        const easyApplyLoc = page.locator(
          [
            'button:has-text("Easy Apply")',
            'button.jobs-apply-button:has-text("Easy")',
            'span.artdeco-button__text:has-text("Easy Apply")',
            '.jobs-apply-button--top-card:has-text("Easy Apply")',
          ].join(", "),
        );
        if ((await easyApplyLoc.count()) > 0) {
          isEasyApply = true;
        }

        // Fallback: check page text for "Easy Apply" badge
        if (!isEasyApply) {
          const pageText = await page.textContent("body").catch(() => "");
          if (pageText.includes("Easy Apply")) {
            isEasyApply = true;
          }
        }
      } catch (e) {
        console.log(`   ⚠️ Could not detect button: ${e.message}`);
      }

      // 4. Update
      job.applyType = isEasyApply ? "easy_apply" : "company_site";
      job.easyApply = isEasyApply;
      job.status = "done";
      job.classifiedAt = new Date();
      await job.save();

      classified++;
      console.log(`   ✅ Classified as: ${job.applyType}`);
    } catch (err) {
      console.log(`   ❌ Error processing job: ${err.message}`);
      job.status = "failed";
      job.retryCount = (job.retryCount || 0) + 1;
      await job.save();
      failed++;
    }

    // 5. Add Human-like Delays
    if (index < jobs.length - 1) {
      if ((index + 1) % 10 === 0) {
        console.log("   ⏳ Taking a 20 sec pause...");
        await sleep(20000);
      } else {
        const delay = getRandomDelay();
        console.log(`   ⏳ Delaying for ${Math.round(delay / 1000)}s...`);
        await sleep(delay);
      }
    }
  }

  await browser.close();
  console.log(
    `\n🏁 Classification Worker Finished. Classified: ${classified}, Failed: ${failed}`,
  );
}

module.exports = { processLinkedInJobs };
