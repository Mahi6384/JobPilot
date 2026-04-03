const { chromium } = require("playwright");
const path = require("path");

const SESSION_PATH = path.join(__dirname, "linkedin-session.json");

async function saveLinkedInSession() {
  console.log("🔐 Opening LinkedIn login page...");
  console.log("   You have 90 seconds to login manually.\n");
  console.log("   Steps:");
  console.log("   1. Enter your LinkedIn email/password");
  console.log("   2. Complete any 2FA if prompted");
  console.log("   3. Wait until you see your LinkedIn feed");
  console.log("   4. The session will be saved automatically\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  await page.goto("https://www.linkedin.com/login");

  // Wait 90 seconds for manual login
  console.log("⏳ Waiting for you to login (90s timeout)...\n");
  await page.waitForTimeout(90000);

  // Verify login was successful by checking for feed or profile elements
  const currentUrl = page.url();
  if (
    currentUrl.includes("/feed") ||
    currentUrl.includes("/mynetwork") ||
    currentUrl.includes("/in/")
  ) {
    console.log("✅ Login detected! Saving session...");
  } else {
    console.log(
      "⚠️  Could not confirm login (current URL: " + currentUrl + ")",
    );
    console.log("   Saving session anyway — it may still work.\n");
  }

  await context.storageState({ path: SESSION_PATH });

  console.log(`✅ LinkedIn session saved to: ${SESSION_PATH}`);
  console.log("   Now you can run: npm run scrape:linkedin\n");
  console.log("📋 To use in GitHub Actions:");
  console.log("   1. Run this in PowerShell:");
  console.log(
    `      [Convert]::ToBase64String([IO.File]::ReadAllBytes("${SESSION_PATH}"))`,
  );
  console.log(
    "   2. Copy the output and add it as a GitHub secret named LINKEDIN_SESSION",
  );
  console.log(
    "   ⚠️  Sessions expire after ~7 days — re-run this script to refresh\n",
  );

  await browser.close();
}

saveLinkedInSession().catch((err) => {
  console.error("❌ Failed to save LinkedIn session:", err.message);
  process.exit(1);
});
