const { chromium } = require("playwright");

const scrapeJobs = async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // scraping from naukri (just for demo purspose)
  await page.goto(
    "https://www.naukri.com/software-engineer-jobs?k=software%20engineer"
  );

  await page.waitForSelector(".srp-jobtuple-wrapper");

  // Extracting  job cards
  const jobs = await page.$$eval(".srp-jobtuple-wrapper", (cards) =>
    cards.map((card) => ({
      title: card.querySelector(".title")?.innerText.trim(),
      companyName: card.querySelector(".comp-name")?.innerText.trim(),
      location: card.querySelector(".loc")?.innerText.trim(),
      experience: card.querySelector(".expwdth")?.innerText.trim(),
    }))
  );
  await browser.close();
  // console.log(jobs);
  return jobs;
};
// scrapeJobs();
module.exports = scrapeJobs;
