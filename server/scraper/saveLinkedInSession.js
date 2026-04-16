const { chromium } = require("playwright");
const path = require("path");

const SESSION_PATH = path.join(__dirname, "linkedin-session.json");

const LOGIN_WAIT_MS = Math.min(
  Math.max(
    parseInt(process.env.LINKEDIN_LOGIN_WAIT_MS || "180000", 10) || 180000,
    30000,
  ),
  600000,
);

async function saveLinkedInSession() {
  const waitSec = Math.round(LOGIN_WAIT_MS / 1000);
  console.log("🔐 Opening LinkedIn login page...");
  console.log(`   You have up to ${waitSec}s to log in (set LINKEDIN_LOGIN_WAIT_MS to change).\n`);
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

  console.log(`⏳ Log in in the browser window. Waiting up to ${waitSec}s...\n`);
  const loggedInPattern = /linkedin\.com\/(feed|mynetwork|jobs)/i;
  const deadline = Date.now() + LOGIN_WAIT_MS;
  let sawLogin = false;
  while (Date.now() < deadline) {
    if (loggedInPattern.test(page.url())) {
      await page.waitForTimeout(2000);
      sawLogin = true;
      console.log("✅ Login detected. Saving session...\n");
      break;
    }
    await page.waitForTimeout(500);
  }
  if (!sawLogin) {
    console.log("⏱️  Timeout reached — saving whatever cookies exist (may be expired).\n");
  }

  const currentUrl = page.url();
  if (
    sawLogin ||
    currentUrl.includes("/feed") ||
    currentUrl.includes("/mynetwork") ||
    currentUrl.includes("/in/")
  ) {
    if (!sawLogin) {
      console.log("✅ Login URL looks OK. Saving session...");
    }
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
