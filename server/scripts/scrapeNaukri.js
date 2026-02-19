// TEMPORARY SCRAPER - DO NOT COMMIT
// This script scrapes Naukri.com for real job listings to populate the database
// for extension testing purposes only

const { chromium } = require("playwright");
const mongoose = require("mongoose");
const Job = require("../models/jobModel");
require("dotenv").config();

const scrapeNaukriJobs = async () => {
  let browser;

  try {
    console.log("🚀 Starting Naukri scraper...\n");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Launch browser
    browser = await chromium.launch({ headless: false }); // Set to true for faster scraping
    const page = await browser.newPage();

    // Navigate to Naukri search results for Software Engineer jobs
    const searchUrl = "https://www.naukri.com/software-engineer-jobs";
    console.log(`🔍 Navigating to: ${searchUrl}\n`);

    await page.goto(searchUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000); // Wait for jobs to load

    // Scroll to load more jobs
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1000);
    }

    // Scrape job listings
    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll(
        ".srp-jobtuple-wrapper, article.jobTuple",
      );
      const scrapedJobs = [];

      jobElements.forEach((element, index) => {
        if (index >= 25) return; // Limit to 25 jobs

        try {
          // Extract job details
          const titleElement = element.querySelector(".title, .title a");
          const companyElement = element.querySelector(
            ".comp-name, .companyInfo a",
          );
          const locationElement = element.querySelector(".location, .locWdth");
          const experienceElement = element.querySelector(".exp, .expwdth");
          const salaryElement = element.querySelector(".salary, .salaryWrap");
          const skillsElement = element.querySelector(".tags, .skill-tags");
          const linkElement = element.querySelector("a.title, a.jobTuple");

          // Only add if we have minimum required data
          if (titleElement && companyElement && linkElement) {
            const title = titleElement.textContent.trim();
            const company = companyElement.textContent.trim();
            const location = locationElement
              ? locationElement.textContent.trim()
              : "Not specified";
            const experienceText = experienceElement
              ? experienceElement.textContent.trim()
              : "0-2 Yrs";
            const salaryText = salaryElement
              ? salaryElement.textContent.trim()
              : "Not disclosed";
            const skillsText = skillsElement
              ? skillsElement.textContent.trim()
              : "";

            // Parse experience
            const expMatch = experienceText.match(/(\d+)-(\d+)/);
            const experienceMin = expMatch ? parseInt(expMatch[1]) : 0;
            const experienceMax = expMatch ? parseInt(expMatch[2]) : 3;

            // Parse skills
            const skills = skillsText
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0 && s.length < 30)
              .slice(0, 8); // Max 8 skills

            // Get job URL
            let jobUrl = linkElement.href;
            if (!jobUrl.startsWith("http")) {
              jobUrl = "https://www.naukri.com" + jobUrl;
            }

            scrapedJobs.push({
              title,
              company,
              location,
              experienceMin,
              experienceMax,
              experienceText,
              salaryText,
              skills,
              applicationUrl: jobUrl,
            });
          }
        } catch (err) {
          console.error("Error parsing job element:", err.message);
        }
      });

      return scrapedJobs;
    });

    console.log(`📦 Scraped ${jobs.length} jobs from Naukri\n`);

    // Transform to match our Job schema
    const jobDocuments = jobs.map((job) => ({
      title: job.title,
      company: job.company,
      location: job.location,
      jobType: "hybrid", // Default to hybrid, can be updated manually
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      salaryMin: 0, // Naukri often doesn't show exact salary
      salaryMax: 0,
      skills:
        job.skills.length > 0 ? job.skills : ["JavaScript", "React", "Node.js"], // Default skills if none found
      description: `${job.title} at ${job.company}. Experience: ${job.experienceMin}-${job.experienceMax} years. Salary: ${job.salaryText}`,
      platform: "naukri",
      applicationUrl: job.applicationUrl,
      easyApply: false, // Naukri doesn't have easy apply like LinkedIn
      postedDate: new Date(), // Current date as we don't know actual posting date
      scrapedAt: new Date(),
    }));

    // Clear existing Naukri jobs (optional)
    await Job.deleteMany({ platform: "naukri" });
    console.log("🗑️  Cleared existing Naukri jobs\n");

    // Insert new jobs
    if (jobDocuments.length > 0) {
      const inserted = await Job.insertMany(jobDocuments);
      console.log(`✅ Inserted ${inserted.length} Naukri jobs into database\n`);

      // Display sample jobs
      console.log("📋 Sample jobs:");
      inserted.slice(0, 5).forEach((job, index) => {
        console.log(`\n${index + 1}. ${job.title} at ${job.company}`);
        console.log(`   Location: ${job.location}`);
        console.log(`   Skills: ${job.skills.join(", ")}`);
        console.log(`   URL: ${job.applicationUrl}`);
      });
    } else {
      console.log("⚠️  No jobs were scraped");
    }

    await browser.close();
    await mongoose.disconnect();

    console.log("\n✅ Scraping completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during scraping:", error);
    if (browser) await browser.close();
    await mongoose.disconnect();
    process.exit(1);
  }
};

scrapeNaukriJobs();
