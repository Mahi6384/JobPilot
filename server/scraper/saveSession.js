const { chromium } = require("playwright");

async function saveSession() {
  console.log("🔐 Opening Naukri login page...");
  console.log("   You have 60 seconds to login manually.\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.naukri.com/nlogin/login");
  await page.waitForTimeout(60000);

  await context.storageState({ path: "./scraper/naukri-session.json" });

  console.log("✅ Session saved to scraper/naukri-session.json!");
  console.log("   Now you can run: npm run scrape\n");

  await browser.close();
}

saveSession();
