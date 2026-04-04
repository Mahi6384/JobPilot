const config = require("./config");
const fs = require("fs");
const path = require("path");

const SESSION_PATH = path.join(__dirname, "linkedin-session.json");

/** Match saveLinkedInSession.js so cookies/session align with how they were saved. */
const LINKEDIN_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Stable job URL for DB unique index (handles www vs in.linkedin.com). */
function canonicalLinkedinJobUrl(href) {
  if (!href || typeof href !== "string") return "";
  try {
    const u = new URL(href);
    const m = u.pathname.match(/\/jobs\/view\/(\d+)/);
    if (!m) return "";
    return `https://www.linkedin.com/jobs/view/${m[1]}`;
  } catch {
    return "";
  }
}

function buildSearchUrl(query, page = 1) {
  const encoded = encodeURIComponent(query);
  const start = (page - 1) * 25;
  return `https://www.linkedin.com/jobs/search/?keywords=${encoded}&location=India&f_AL=true&start=${start}`;
}

/**
 * Naukri-style: wait for any job links, scroll window + list shells, collect unique /jobs/view/{id} URLs.
 * Does not depend on fragile split-pane list item class names.
 */
async function collectJobLinks(page) {
  const timeout = config.linkedinListLinkTimeout ?? 25000;
  try {
    await page.waitForSelector('a[href*="/jobs/view/"]', { timeout });
  } catch {
    console.log(
      "   ⏳ Timeout waiting for LinkedIn job links (check session / login / selectors)",
    );
  }

  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, Math.floor(window.innerHeight * 0.85));
      document
        .querySelectorAll(
          '[class*="scaffold-layout__list"], [class*="jobs-search-results-list"], [class*="job-search-results"]',
        )
        .forEach((el) => {
          try {
            el.scrollTop = el.scrollHeight;
          } catch {
            /* ignore */
          }
        });
    });
    await page.waitForTimeout(900);
  }

  const hrefs = await page.evaluate(() => {
    const seen = new Set();
    const out = [];
    document.querySelectorAll('a[href*="/jobs/view/"]').forEach((el) => {
      const href = el.href;
      if (!href) return;
      const m = href.match(/\/jobs\/view\/(\d+)/);
      if (!m || seen.has(m[1])) return;
      seen.add(m[1]);
      out.push(href.split("?")[0]);
    });
    return out;
  });

  return hrefs.slice(0, 60);
}

/**
 * Visit job detail page; return fields only if LinkedIn Easy Apply is present (in-app apply).
 */
async function scrapeJobPage(page, jobUrl) {
  const canonical = canonicalLinkedinJobUrl(jobUrl);
  if (!canonical) return null;

  try {
    await page.goto(canonical, {
      waitUntil: "domcontentloaded",
      timeout: 35000,
    });

    await page
      .waitForSelector(
        'h1, .jobs-unified-top-card__job-title, [class*="jobs-unified-top-card"], [class*="job-details-jobs-unified"]',
        { timeout: 15000 },
      )
      .catch(() => {});

    await page.waitForTimeout(2500);

    return await page.evaluate(() => {
      const ariaEasyApply = () => {
        return [...document.querySelectorAll("a[aria-label], button[aria-label]")].some(
          (el) => {
            const label = (el.getAttribute("aria-label") || "").toLowerCase();
            return label.includes("easy apply");
          },
        );
      };

      const textEasyApplyCta = () => {
        const nodes = document.querySelectorAll("a, button");
        for (const el of nodes) {
          const t = (el.innerText || "").trim().toLowerCase();
          if (
            t === "easy apply" ||
            (t.startsWith("easy apply") && t.length < 40)
          ) {
            return true;
          }
        }
        return false;
      };

      if (!ariaEasyApply() && !textEasyApplyCta()) {
        return null;
      }

      const pickJobTitle = () => {
        const bad = (s) =>
          !s ||
          s.length < 2 ||
          s.length > 220 ||
          /^linkedin$/i.test(s) ||
          /^jobs$/i.test(s);

        const tryText = (el) => {
          const t = el?.innerText?.trim() || el?.textContent?.trim() || "";
          return bad(t) ? "" : t;
        };

        const selectors = [
          ".jobs-unified-top-card__job-title",
          ".jobs-details-top-card__title-text",
          ".job-details-jobs-unified-top-card__job-title",
          "h1.jobs-unified-top-card__job-title",
          ".job-details-jobs-unified-top-card h1",
          ".jobs-details-top-card h1",
          '[class*="jobs-unified-top-card"] h1',
          'a[data-control-name="job_card_title"]',
          '[class*="top-card"] [class*="job-title"]',
          '[class*="job-title"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          const t = tryText(el);
          if (t) return t;
        }

        const regions = document.querySelectorAll(
          'main h1, [role="main"] h1, .scaffold-layout__detail h1, .jobs-details h1',
        );
        for (const h of regions) {
          const t = tryText(h);
          if (t) return t;
        }

        const metaOg = document.querySelector(
          'meta[property="og:title"]',
        )?.content;
        if (metaOg && !bad(metaOg.trim())) {
          const m = metaOg.split("|")[0]?.trim();
          if (m && !bad(m)) return m;
        }

        const dt = document.title || "";
        if (dt.includes("|")) {
          const first = dt.split("|")[0].trim();
          if (first && !bad(first)) return first;
        }

        return "";
      };

      const title = pickJobTitle() || "Unknown";

      const company =
        document
          .querySelector(".job-details-jobs-unified-top-card__company-name")
          ?.innerText?.trim() ||
        document.querySelector('a[href*="/company/"]')?.innerText?.trim() ||
        "Unknown";

      const location =
        document
          .querySelector(
            ".job-details-jobs-unified-top-card__primary-description span",
          )
          ?.innerText?.trim() ||
        document.querySelector('[class*="topcard__flavor"]')?.innerText?.trim() ||
        "Not specified";

      let experience = "Not specified";
      document.querySelectorAll("li").forEach((li) => {
        const h3 = li.querySelector("h3");
        if (!h3) return;
        const key = h3.innerText.trim().toLowerCase();
        if (
          key.includes("experience") ||
          key.includes("seniority") ||
          key.includes("experience level")
        ) {
          const span = li.querySelector("span");
          if (span?.innerText?.trim()) experience = span.innerText.trim();
        }
      });

      const description =
        document
          .querySelector(
            ".jobs-description-content__text, .show-more-less-html__markup, [class*='jobs-description']",
          )
          ?.innerText?.trim() || "";

      const skills = [];
      document
        .querySelectorAll(
          '[class*="job-skill"], .description__job-criteria-item span, [data-test-id*="skill"]',
        )
        .forEach((el) => {
          const s = (el.innerText || "").trim();
          if (s && s.length > 1 && s.length < 40 && !skills.includes(s)) {
            skills.push(s);
          }
        });

      return {
        title,
        company,
        location,
        experience,
        salary: "Not disclosed",
        skills: skills.slice(0, 10),
        description: description.slice(0, 8000),
      };
    });
  } catch {
    return null;
  }
}

/**
 * Same flow as naukriScraper: search pages → collect links → visit each JD → gate + extract → applicationUrl.
 */
async function scrapeQuery(browser, query) {
  const hasSession = fs.existsSync(SESSION_PATH);
  if (!hasSession) {
    console.log(
      "   ⚠️  No linkedin-session.json — run: npm run save:linkedin (scraping may fail or be limited)",
    );
  }

  const contextOptions = {
    userAgent: LINKEDIN_USER_AGENT,
    viewport: { width: 1280, height: 900 },
    ...(hasSession ? { storageState: SESSION_PATH } : {}),
  };

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const allJobs = [];
  const maxJobs = config.linkedinMaxJobsPerQuery ?? 15;

  try {
    for (let pageNum = 1; pageNum <= config.maxPagesPerQuery; pageNum++) {
      try {
        const searchUrl = buildSearchUrl(query, pageNum);

        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        await page.waitForTimeout(config.delayBetweenPages || 3000);

        const jobLinks = await collectJobLinks(page);

        if (jobLinks.length === 0) {
          console.log(
            `   LinkedIn page ${pageNum}: no job links (check session or selectors)`,
          );
          break;
        }

        let addedThisPage = 0;
        let skippedNoEasyApply = 0;
        let badUrls = 0;

        for (let i = 0; i < jobLinks.length; i++) {
          const applicationUrl = canonicalLinkedinJobUrl(jobLinks[i]);
          if (!applicationUrl) {
            badUrls++;
            continue;
          }

          const jobInfo = await scrapeJobPage(page, applicationUrl);

          if (jobInfo) {
            addedThisPage++;
            allJobs.push({ ...jobInfo, applicationUrl });
          } else {
            skippedNoEasyApply++;
          }

          await page.waitForTimeout(1500);

          if (allJobs.length >= maxJobs) {
            console.log(
              `   LinkedIn: reached ${maxJobs} Easy Apply jobs for this query`,
            );
            break;
          }
        }

        console.log(
          `   LinkedIn page ${pageNum}: +${addedThisPage} saved (${skippedNoEasyApply} no Easy Apply, ${badUrls} bad URL) of ${jobLinks.length} links`,
        );

        if (allJobs.length >= maxJobs) break;
      } catch (err) {
        if (
          err.message &&
          err.message.includes("Target page, context or browser has been closed")
        ) {
          console.log(
            "   ❌ LinkedIn stopped: browser/context closed",
          );
          break;
        }
        throw err;
      }
    }
  } finally {
    await context.close().catch(() => {});
  }

  return allJobs;
}

module.exports = { scrapeQuery };
