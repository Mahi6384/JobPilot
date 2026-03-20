const config = require("./config");
const fs = require("fs");

function buildSearchUrl(query, page = 1) {
  const slug = query.toLowerCase().replace(/\s+/g, "-");
  const encoded = encodeURIComponent(query);
  const pageParam = page > 1 ? `-${page}` : "";
  return `https://www.naukri.com/${slug}-jobs${pageParam}?k=${encoded}&nignbevent_src=jobsearchDeskGNB`;
}

async function collectJobLinks(page) {
  try {
    await page.waitForSelector("a.title", { timeout: 10000 });
  } catch (err) {
    console.log("   ⏳ Timeout waiting for job cards... page might be slow or empty");
  }

  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(1000);
  }

  const links = await page.evaluate(() => {
    const urls = [];
    document.querySelectorAll("a.title").forEach((el) => {
      if (el.href && el.href.includes("naukri.com")) {
        urls.push(el.href);
      }
    });
    return urls;
  });

  return links.slice(0, config.maxJobsPerQuery);
}

async function scrapeJobPage(page, jobUrl) {
  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    return await page.evaluate(() => {
      const companySiteBtn = document.getElementById("company-site-button");
      if (companySiteBtn) return null;

      const applyBtn = document.getElementById("apply-button");
      if (!applyBtn) return null;

      const btnText = applyBtn.textContent.trim().toLowerCase();
      if (btnText !== "apply" && btnText !== "login to apply") return null;

      const title =
        document
          .querySelector(".styles_jd-header-title__rZwM1")
          ?.textContent?.trim() ||
        document.querySelector("h1")?.textContent?.trim() ||
        "Unknown";

      const company =
        document
          .querySelector(".styles_jd-header-comp-name__MvqAI a")
          ?.textContent?.trim() ||
        document.querySelector("[class*='comp-name']")?.textContent?.trim() ||
        "Unknown";

      const location =
        document
          .querySelector(".styles_jhc__loc___Du2H")
          ?.textContent?.trim() ||
        document.querySelector("[class*='loc']")?.textContent?.trim() ||
        "Not specified";

      const experience =
        document
          .querySelector(".styles_jhc__exp__k_giM")
          ?.textContent?.trim() ||
        document.querySelector("[class*='exp']")?.textContent?.trim() ||
        "0-2 Yrs";

      const salary =
        document
          .querySelector(".styles_jhc__salary__jdfEC")
          ?.textContent?.trim() || "Not disclosed";

      const skills = [];
      document
        .querySelectorAll(
          ".styles_key-skill__GIPn_ a, [class*='chip'] span, [class*='skill'] a",
        )
        .forEach((el) => {
          const s = el.textContent.trim();
          if (s && s.length < 30) skills.push(s);
        });

      return {
        title,
        company,
        location,
        experience,
        salary,
        skills: skills.slice(0, 10),
      };
    });
  } catch (error) {
    return null;
  }
}

async function scrapeQuery(browser, query) {
  const sessionPath = "./scraper/naukri-session.json";
  const contextOptions = fs.existsSync(sessionPath)
    ? { storageState: sessionPath }
    : {};

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const allJobs = [];

  try {
    for (let pageNum = 1; pageNum <= config.maxPagesPerQuery; pageNum++) {
      const searchUrl = buildSearchUrl(query, pageNum);
      console.log(`\n   🔍 Page ${pageNum}: ${searchUrl.substring(0, 80)}...`);

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(config.delayBetweenPages);

      const jobLinks = await collectJobLinks(page);
      console.log(`   📦 Found ${jobLinks.length} job links`);

      if (jobLinks.length === 0) {
        console.log("   ⚠️  No results, moving to next query");
        break;
      }

      for (let i = 0; i < jobLinks.length; i++) {
        const jobInfo = await scrapeJobPage(page, jobLinks[i]);

        if (jobInfo) {
          console.log(
            `   ✅ [${i + 1}/${jobLinks.length}] ${jobInfo.title} at ${jobInfo.company}`,
          );
          allJobs.push({ ...jobInfo, applicationUrl: jobLinks[i] });
        } else {
          console.log(`   ❌ [${i + 1}/${jobLinks.length}] Skipped`);
        }

        await page.waitForTimeout(1500);
      }
    }
  } finally {
    await context.close();
  }

  return allJobs;
}

module.exports = { scrapeQuery, buildSearchUrl };
