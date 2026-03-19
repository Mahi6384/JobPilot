const { chromium } = require("playwright");
const mongoose = require("mongoose");
const Job = require("../models/jobModel");
require("dotenv").config();

const scrapeNaukriJobs = async () => {
  let browser;

  try {
    console.log("🚀 Starting Naukri scraper (Direct Apply jobs only)...\n");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Launch browser (headless: false so you can see what's happening)
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Navigate to Naukri search results
    const searchUrl =
      "https://www.naukri.com/software-engineer-jobs?k=software%20engineer&experience=0";
    console.log(`🔍 Navigating to: ${searchUrl}\n`);

    await page.goto(searchUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Scroll to load more jobs
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1000);
    }

    // Step 1: Collect all job URLs from the search results page
    const jobLinks = await page.evaluate(() => {
      const links = [];
      const titleElements = document.querySelectorAll("a.title");
      titleElements.forEach((el) => {
        if (el.href && el.href.includes("naukri.com")) {
          links.push(el.href);
        }
      });
      return links.slice(0, 20); // Check up to 20 jobs
    });

    console.log(`📦 Found ${jobLinks.length} job links to check\n`);

    // Step 2: Visit each job page and check if it has a direct Apply button
    const directApplyJobs = [];

    for (let i = 0; i < jobLinks.length; i++) {
      const jobUrl = jobLinks[i];
      console.log(
        `[${i + 1}/${jobLinks.length}] Checking: ${jobUrl.substring(0, 80)}...`,
      );

      try {
        await page.goto(jobUrl, { waitUntil: "networkidle", timeout: 10000 });
        await page.waitForTimeout(2000);

        // Check if this job has a direct Apply button (not "Apply on Company Site")

        const jobInfo = await page.evaluate(() => {
          const companySiteBtn = document.getElementById("company-site-button");
          if (companySiteBtn) return null;
          const applyBtn = document.getElementById("apply-button");
          if (!applyBtn) return null;

          // Check if it says "Apply" or "Login to Apply" (both indicate direct apply)
          const btnText = applyBtn.textContent.trim().toLowerCase();
          if (btnText !== "apply" && btnText !== "login to apply") return null;

          // Extract job details from the detail page
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
            document
              .querySelector("[class*='comp-name']")
              ?.textContent?.trim() ||
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

          // Get skills
          const skillElements = document.querySelectorAll(
            ".styles_key-skill__GIPn_ a, [class*='chip'] span, [class*='skill'] a",
          );
          const skills = [];
          skillElements.forEach((el) => {
            const s = el.textContent.trim();
            if (s && s.length < 30) skills.push(s);
          });

          return {
            title,
            company,
            location,
            experience,
            salary,
            skills: skills.slice(0, 8),
          };
        });

        if (jobInfo) {
          console.log(
            `   ✅ DIRECT APPLY: ${jobInfo.title} at ${jobInfo.company}`,
          );
          directApplyJobs.push({ ...jobInfo, applicationUrl: jobUrl });
        } else {
          console.log(`   ❌ Skipped (no direct Apply or external link)`);
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
      }

      // Stop if we have enough jobs
      if (directApplyJobs.length >= 10) {
        console.log("\n✅ Found 10 direct apply jobs, stopping early");
        break;
      }
    }

    console.log(`\n📦 Found ${directApplyJobs.length} Direct Apply jobs\n`);

    if (directApplyJobs.length === 0) {
      console.log("⚠️  No direct apply jobs found. Try a different search.");
      await browser.close();
      await mongoose.disconnect();
      process.exit(0);
    }

    // Step 3: Transform and save to database
    const jobDocuments = directApplyJobs.map((job) => {
      const expMatch = job.experience.match(/(\d+)/g);
      const experienceMin = expMatch ? parseInt(expMatch[0]) : 0;
      const experienceMax =
        expMatch && expMatch[1] ? parseInt(expMatch[1]) : experienceMin + 2;

      return {
        title: job.title,
        company: job.company,
        location: job.location,
        jobType: "hybrid",
        experienceMin,
        experienceMax,
        salaryMin: 0,
        salaryMax: 0,
        skills:
          job.skills.length > 0
            ? job.skills
            : ["JavaScript", "React", "Node.js"],
        description: `${job.title} at ${job.company}. Experience: ${job.experience}. Salary: ${job.salary}`,
        platform: "naukri",
        applicationUrl: job.applicationUrl,
        easyApply: true, // These are verified direct apply jobs!
        postedDate: new Date(),
        scrapedAt: new Date(),
      };
    });

    // Clear existing Naukri jobs
    await Job.deleteMany({ platform: "naukri" });
    console.log("🗑️  Cleared existing Naukri jobs\n");

    // Insert new jobs
    const inserted = await Job.insertMany(jobDocuments);
    console.log(
      `✅ Inserted ${inserted.length} Direct Apply jobs into database\n`,
    );

    // Display jobs
    console.log("📋 Jobs saved:");
    inserted.forEach((job, i) => {
      console.log(`\n${i + 1}. ${job.title} at ${job.company}`);
      console.log(`   Location: ${job.location}`);
      console.log(`   Skills: ${job.skills.join(", ")}`);
      console.log(`   URL: ${job.applicationUrl.substring(0, 80)}...`);
    });

    await browser.close();
    await mongoose.disconnect();

    console.log("\n✅ Scraping completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    if (browser) await browser.close();
    await mongoose.disconnect();
    process.exit(1);
  }
};

scrapeNaukriJobs();
