const Job = require("../models/jobModel");
const AppliedJob = require("../models/appliedJobModel");
const UserProfile = require("../models/userProfileModel");
const NaukriSession = require("../models/naukriSessionModel");
const LinkedInSession = require("../models/linkedinSessionModel");
const jobScrapper = require("../scrapper/jobScrapper");
const fillJobApplication = require("../scrapper/jobApplicationFiller");
const { chromium } = require("playwright");
const logger = require("../utils/logger");

// Scrape jobs for a specific user based on their profile
// Helper function to scroll page and load all job cards
const scrollPageToLoadAllJobs = async (page) => {
  let previousHeight = 0;
  let currentHeight = await page.evaluate(() => document.body.scrollHeight);
  let scrollAttempts = 0;
  const maxScrollAttempts = 50; // Prevent infinite scrolling

  while (
    previousHeight !== currentHeight &&
    scrollAttempts < maxScrollAttempts
  ) {
    previousHeight = currentHeight;

    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for new content to load
    await page.waitForTimeout(2000);

    // Get new height
    currentHeight = await page.evaluate(() => document.body.scrollHeight);
    scrollAttempts++;
  }

  // Scroll back to top
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);
};

// Main scraping function - filters for Naukri-direct-apply jobs only
const scrapeUserJobs = async (req, res) => {
  let browser = null;
  try {
    const userId = req.userId;

    // Get user profile
    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      return res.status(400).json({
        message: "Please complete your profile first",
      });
    }

    // Get Naukri session
    const session = await NaukriSession.findOne({ userId });
    if (!session || session.expiresAt < new Date()) {
      return res.status(400).json({
        message: "Please connect your Naukri account first",
      });
    }

    logger.info(`Scraping jobs for user: ${userId}`);

    // Get search URL from query param or build from profile
    const searchUrl =
      req.query.url ||
      (() => {
        const roles = profile.preferredRoles.join("%20");
        const locations = profile.preferredLocations.join("%20");
        return `https://www.naukri.com/${roles}-jobs?k=${roles}&l=${locations}`;
      })();

    logger.info(`Navigating to: ${searchUrl}`);

    // Launch browser with saved cookies
    browser = await chromium.launch({
      headless: process.env.HEADLESS === "true" || false,
    });

    const context = await browser.newContext();

    // Restore cookies
    try {
      const cookies = session.decryptCookies();
      await context.addCookies(cookies);
      logger.info(`Restored ${cookies.length} cookies for user ${userId}`);
    } catch (error) {
      logger.error("Failed to restore cookies", error);
      await browser.close();
      return res.status(500).json({
        message:
          "Failed to restore Naukri session. Please reconnect your account.",
      });
    }

    const page = await context.newPage();
    page.setDefaultTimeout(60000);

    // Navigate to search page
    try {
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      logger.info("Page navigation successful");
    } catch (error) {
      logger.error(`Navigation failed: ${error.message}`);
      await browser.close();
      return res.status(500).json({
        message: `Failed to load Naukri page: ${error.message}`,
      });
    }

    // Wait for initial content
    await page.waitForTimeout(3000);

    // Check if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes("login") || currentUrl.includes("signin")) {
      logger.warn("Redirected to login page - session may have expired");
      await browser.close();
      return res.status(401).json({
        message: "Session expired. Please reconnect your Naukri account.",
      });
    }

    // Wait for job cards to appear
    try {
      await page.waitForSelector(".srp-jobtuple-wrapper", { timeout: 20000 });
      logger.info("Job cards selector found on page");
    } catch (error) {
      logger.warn(`Job cards selector not found: ${error.message}`);
      await browser.close();
      return res.status(200).json({
        message:
          "No job cards found. The page structure may have changed or no jobs available.",
        data: [],
        total: 0,
      });
    }

    // Scroll page fully to load all job cards
    logger.info("Scrolling page to load all job cards...");
    await scrollPageToLoadAllJobs(page);
    logger.info("Finished scrolling page");

    // Get total job cards count before filtering
    const totalJobCards = await page.$$eval(
      ".srp-jobtuple-wrapper",
      (cards) => cards.length
    );
    logger.info(`Total job cards found: ${totalJobCards}`);

    // Extract all job cards with detailed information
    const allJobs = await page.evaluate(() => {
      const jobCards = document.querySelectorAll(".srp-jobtuple-wrapper");
      const jobs = [];

      jobCards.forEach((card, index) => {
        try {
          // Get title and job link
          const titleElement =
            card.querySelector(".title") ||
            card.querySelector("a.title") ||
            card.querySelector('[class*="title"]');
          if (!titleElement) return;

          const jobLink = titleElement.getAttribute("href") || "";
          const fullJobLink =
            jobLink && jobLink.startsWith("http")
              ? jobLink
              : jobLink
                ? `https://www.naukri.com${jobLink}`
                : "";

          // Extract job ID from URL if available
          const jobIdMatch =
            jobLink.match(/jobid[=/-](\d+)/i) ||
            jobLink.match(/\/(\d+)(?:\?|$)/);
          const jobId = jobIdMatch ? jobIdMatch[1] : `job-${index}`;

          // Get company name
          const companyElement =
            card.querySelector(".comp-name") ||
            card.querySelector('[class*="comp"]') ||
            card.querySelector('[class*="company"]');
          const companyName = companyElement
            ? companyElement.innerText.trim()
            : "";

          // Get location
          const locationElement =
            card.querySelector(".loc") ||
            card.querySelector('[class*="loc"]') ||
            card.querySelector('[class*="location"]');
          const location = locationElement
            ? locationElement.innerText.trim()
            : "";

          // Get experience
          const expElement =
            card.querySelector(".expwdth") ||
            card.querySelector('[class*="exp"]') ||
            card.querySelector('[class*="experience"]');
          const experience = expElement ? expElement.innerText.trim() : "";

          // Get salary
          const salaryElement =
            card.querySelector(".sal") ||
            card.querySelector('[class*="sal"]') ||
            card.querySelector('[class*="salary"]');
          const salary = salaryElement ? salaryElement.innerText.trim() : "";

          // Get posted date
          const dateElement =
            card.querySelector(".date") ||
            card.querySelector('[class*="date"]') ||
            card.querySelector('[class*="posted"]');
          const postedDate = dateElement ? dateElement.innerText.trim() : "";

          // Find Apply button - try multiple selectors
          let applyButton = null;

          // Try class-based selectors first
          applyButton =
            card.querySelector('button[class*="apply"]') ||
            card.querySelector('a[class*="apply"]') ||
            card.querySelector('button[class*="Apply"]') ||
            card.querySelector('a[class*="Apply"]');

          // If not found, search by text content
          if (!applyButton) {
            const buttonsAndLinks = Array.from(
              card.querySelectorAll("button, a")
            );
            applyButton = buttonsAndLinks.find((el) => {
              const text = (el.innerText || el.textContent || "").toLowerCase();
              return text.includes("apply") && !text.includes("applied");
            });
          }

          // Check if job card contains "Apply on company website"
          const cardText = card.innerText || card.textContent || "";
          const hasCompanyWebsiteApply = cardText
            .toLowerCase()
            .includes("apply on company website");

          // Check if Apply button has target="_blank"
          const hasTargetBlank =
            applyButton && applyButton.getAttribute("target") === "_blank";

          // Check if button would redirect (external link)
          const isExternalLink =
            applyButton &&
            applyButton.tagName === "A" &&
            applyButton.href &&
            !applyButton.href.includes("naukri.com");

          // Filter: Only include jobs that are Naukri-direct-apply
          // - Apply button should NOT have target="_blank"
          // - Job card should NOT contain "Apply on company website"
          // - Button should keep user on Naukri (not external link)
          const isNaukriDirectApply =
            applyButton &&
            !hasTargetBlank &&
            !hasCompanyWebsiteApply &&
            !isExternalLink;

          if (isNaukriDirectApply) {
            // Generate CSS selector for the apply button
            let applyButtonSelector = "";
            try {
              if (applyButton.id) {
                applyButtonSelector = `#${applyButton.id}`;
              } else if (applyButton.className) {
                const classes = applyButton.className
                  .split(" ")
                  .filter((c) => c.trim() && !c.includes(" "))
                  .slice(0, 3) // Limit to first 3 classes to avoid overly long selectors
                  .join(".");
                if (classes) {
                  applyButtonSelector = `${applyButton.tagName.toLowerCase()}.${classes}`;
                }
              }

              // If still no selector, use a more specific approach
              if (!applyButtonSelector) {
                // Try to find a unique parent and use nth-child
                const cardParent = card.parentElement;
                if (cardParent) {
                  const cardIndex = Array.from(cardParent.children).indexOf(
                    card
                  );
                  const buttonIndex = Array.from(
                    card.querySelectorAll("button, a")
                  ).indexOf(applyButton);
                  applyButtonSelector = `.srp-jobtuple-wrapper:nth-of-type(${cardIndex + 1}) ${applyButton.tagName.toLowerCase()}:nth-of-type(${buttonIndex + 1})`;
                }
              }

              // Final fallback
              if (!applyButtonSelector) {
                applyButtonSelector = `.srp-jobtuple-wrapper:nth-of-type(${index + 1}) ${applyButton.tagName.toLowerCase()}[class*="apply"]`;
              }
            } catch (selectorError) {
              // If selector generation fails, use a basic fallback
              applyButtonSelector = `.srp-jobtuple-wrapper:nth-of-type(${index + 1}) ${applyButton.tagName.toLowerCase()}`;
            }

            jobs.push({
              jobId,
              jobTitle: titleElement.innerText.trim(),
              companyName,
              location,
              experience,
              salary,
              postedDate,
              jobLink: fullJobLink,
              applyButtonSelector,
            });
          }
        } catch (error) {
          console.error(`Error processing job card ${index}:`, error);
        }
      });

      return jobs;
    });

    logger.info(`Naukri-direct-apply jobs: ${allJobs.length}`);

    await browser.close();

    // Delete old jobs for this user
    await Job.deleteMany({ userId, applied: false });
    logger.info(`Deleted old jobs for user ${userId}`);

    // Save new jobs
    if (allJobs.length > 0) {
      const jobsToSave = allJobs.map((job) => ({
        title: job.jobTitle || "Untitled Job",
        companyName: job.companyName || "Unknown Company",
        location: job.location || "",
        experience: job.experience || "",
        salary: job.salary || "",
        postedDate: job.postedDate || "",
        jobUrl: job.jobLink || "",
        jobId: job.jobId || "",
        applyButtonSelector: job.applyButtonSelector || "",
        userId,
        postedAt: new Date(),
        applied: false,
        isEasyApply: true, // All scraped jobs are Naukri-direct-apply
      }));

      const savedJobs = await Job.insertMany(jobsToSave);
      logger.info(`Saved ${savedJobs.length} jobs for user: ${userId}`);

      res.status(200).json({
        message: "Jobs scraped and saved successfully",
        data: savedJobs,
        total: savedJobs.length,
      });
    } else {
      logger.warn(`No Naukri-direct-apply jobs found for user ${userId}`);
      res.status(200).json({
        message:
          "No Naukri-direct-apply jobs found. All jobs may require applying on company website.",
        data: [],
        total: 0,
      });
    }
  } catch (error) {
    logger.error("Error scraping user jobs", error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({
      message: "Failed to scrape jobs",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get jobs for a specific user
const getUserJobs = async (req, res) => {
  try {
    const userId = req.userId;
    const { applied } = req.query;

    let query = { userId };
    if (applied !== undefined) {
      query.applied = applied === "true";
    }

    const jobs = await Job.find(query).sort({ createdAt: -1 }).limit(10);

    res.status(200).json({
      message: "Jobs retrieved successfully",
      data: jobs,
      total: jobs.length,
    });
  } catch (error) {
    logger.error("Error fetching user jobs", error);
    res.status(500).json({
      message: "Failed to fetch jobs",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Apply to a job
const applyToJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.userId;

    // Get job
    const job = await Job.findOne({ _id: jobId, userId });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.applied) {
      return res.status(400).json({ message: "Job already applied" });
    }

    // Get user profile
    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      return res.status(400).json({ message: "Profile not found" });
    }

    // Get Naukri session
    const session = await NaukriSession.findOne({ userId });
    if (!session || session.expiresAt < new Date()) {
      return res.status(400).json({
        message: "Naukri session expired. Please reconnect your account.",
      });
    }

    logger.info(`Applying to job ${jobId} for user ${userId}`);

    // Launch browser with cookies
    const browser = await chromium.launch({
      headless: false,
      slowMo: 500,
    });

    const context = await browser.newContext();
    const cookies = session.decryptCookies();
    await context.addCookies(cookies);

    const page = await context.newPage();
    await page.goto(job.jobUrl, { waitUntil: "networkidle" });

    // Prepare user data
    const userData = {
      name: profile.name,
      email: req.user.email,
      experience: profile.experience,
      expectedCTC: profile.expectedCTC,
      resumePath: profile.resumePath,
    };

    // Fill and submit application - pass the page instead of URL
    const result = await fillJobApplication(page, userData);

    await browser.close();

    if (result.success) {
      // Mark job as applied
      job.applied = true;
      await job.save();

      // Create applied job record
      const appliedJob = new AppliedJob({
        userId,
        jobId: job._id,
        status: "applied",
        appliedAt: new Date(),
      });
      await appliedJob.save();

      logger.info(`Successfully applied to job ${jobId}`);

      res.status(200).json({
        message: "Application submitted successfully",
        data: appliedJob,
      });
    } else {
      // Create failed record
      const appliedJob = new AppliedJob({
        userId,
        jobId: job._id,
        status: "failed",
        errorMessage: result.message,
      });
      await appliedJob.save();

      res.status(500).json({
        message: "Failed to submit application",
        error: result.message,
      });
    }
  } catch (error) {
    logger.error("Error applying to job", error);
    res.status(500).json({
      message: "Failed to apply to job",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Auto-apply to top N jobs
const autoApplyJobs = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 10 } = req.body;

    // Get unapplied jobs
    const jobs = await Job.find({ userId, applied: false })
      .sort({ createdAt: -1 })
      .limit(limit);

    if (jobs.length === 0) {
      return res.status(200).json({
        message: "No jobs available to apply",
        applied: 0,
      });
    }

    // Get user profile
    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      return res.status(400).json({ message: "Profile not found" });
    }

    // Get Naukri session
    const session = await NaukriSession.findOne({ userId });
    if (!session || session.expiresAt < new Date()) {
      return res.status(400).json({
        message: "Naukri session expired. Please reconnect your account.",
      });
    }

    let appliedCount = 0;
    const results = [];
    let browser = null;

    try {
      // Launch browser once for all applications
      browser = await chromium.launch({
        headless: process.env.HEADLESS === "true" || false,
        slowMo: 500,
      });

      const context = await browser.newContext();
      const cookies = session.decryptCookies();
      await context.addCookies(cookies);

      // Prepare user data
      const userData = {
        name: profile.name,
        email: req.user.email,
        experience: profile.experience,
        expectedCTC: profile.expectedCTC,
        resumePath: profile.resumePath,
      };

      for (const job of jobs) {
        try {
          if (job.applied) {
            results.push({
              jobId: job._id,
              title: job.title,
              status: "skipped",
              message: "Already applied",
            });
            continue;
          }

          logger.info(`Auto-applying to job ${job._id} for user ${userId}`);

          const page = await context.newPage();
          await page.goto(job.jobUrl, { waitUntil: "networkidle" });

          // Fill and submit application
          const result = await fillJobApplication(page, userData);

          await page.close();

          if (result.success && result.submitted) {
            // Mark job as applied
            job.applied = true;
            await job.save();

            // Create applied job record
            const appliedJob = new AppliedJob({
              userId,
              jobId: job._id,
              status: "applied",
              appliedAt: new Date(),
            });
            await appliedJob.save();

            appliedCount++;
            results.push({
              jobId: job._id,
              title: job.title,
              status: "success",
              message: "Application submitted successfully",
            });

            logger.info(`Successfully auto-applied to job ${job._id}`);
          } else {
            // Create failed record
            const appliedJob = new AppliedJob({
              userId,
              jobId: job._id,
              status: "failed",
              errorMessage: result.message || "Application not submitted",
            });
            await appliedJob.save();

            results.push({
              jobId: job._id,
              title: job.title,
              status: "failed",
              message: result.message || "Application not submitted",
            });
          }
        } catch (error) {
          logger.error(`Failed to apply to job ${job._id}`, error);

          // Create failed record
          const appliedJob = new AppliedJob({
            userId,
            jobId: job._id,
            status: "failed",
            errorMessage: error.message,
          });
          await appliedJob.save();

          results.push({
            jobId: job._id,
            title: job.title,
            status: "failed",
            error: error.message,
          });
        }
      }
    } finally {
      // Ensure browser is always closed
      if (browser) {
        await browser.close();
      }
    }

    res.status(200).json({
      message: `Auto-applied to ${appliedCount} out of ${jobs.length} jobs`,
      applied: appliedCount,
      total: jobs.length,
      results,
    });
  } catch (error) {
    logger.error("Error in auto-apply", error);
    res.status(500).json({
      message: "Failed to auto-apply jobs",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get applied jobs
const getAppliedJobs = async (req, res) => {
  try {
    const userId = req.userId;

    const appliedJobs = await AppliedJob.find({ userId })
      .populate("jobId")
      .sort({ appliedAt: -1 });

    res.status(200).json({
      message: "Applied jobs retrieved successfully",
      data: appliedJobs,
      total: appliedJobs.length,
    });
  } catch (error) {
    logger.error("Error fetching applied jobs", error);
    res.status(500).json({
      message: "Failed to fetch applied jobs",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Helper function to scroll LinkedIn page and load all job cards
const scrollLinkedInPageToLoadAllJobs = async (page) => {
  let previousHeight = 0;
  let currentHeight = await page.evaluate(() => document.body.scrollHeight);
  let scrollAttempts = 0;
  const maxScrollAttempts = 30; // Prevent infinite scrolling

  while (
    previousHeight !== currentHeight &&
    scrollAttempts < maxScrollAttempts
  ) {
    previousHeight = currentHeight;

    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for new content to load
    await page.waitForTimeout(2000);

    // Get new height
    currentHeight = await page.evaluate(() => document.body.scrollHeight);
    scrollAttempts++;
  }

  // Scroll back to top
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);
};

// Scrape LinkedIn jobs - only Easy Apply jobs
const scrapeLinkedInJobs = async (req, res) => {
  let browser = null;
  try {
    const userId = req.userId;
    const { jobTitle } = req.body; // Get job title from request body

    if (!jobTitle || jobTitle.trim() === "") {
      return res.status(400).json({
        message: "Job title is required",
      });
    }

    // Get LinkedIn session
    const session = await LinkedInSession.findOne({ userId });
    if (!session || session.expiresAt < new Date()) {
      return res.status(400).json({
        message: "Please connect your LinkedIn account first",
      });
    }

    logger.info(
      `Scraping LinkedIn jobs for user: ${userId}, job title: ${jobTitle}`
    );

    // Build LinkedIn job search URL
    const searchQuery = encodeURIComponent(jobTitle.trim());
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${searchQuery}&f_AL=true`; // f_AL=true filters for Easy Apply

    logger.info(`Navigating to: ${searchUrl}`);

    // Launch browser with saved cookies
    browser = await chromium.launch({
      headless: process.env.HEADLESS === "true" || false,
    });

    const context = await browser.newContext();

    // Restore cookies
    try {
      const cookies = session.decryptCookies();
      await context.addCookies(cookies);
      logger.info(`Restored ${cookies.length} cookies for user ${userId}`);
    } catch (error) {
      logger.error("Failed to restore LinkedIn cookies", error);
      await browser.close();
      return res.status(500).json({
        message:
          "Failed to restore LinkedIn session. Please reconnect your account.",
      });
    }

    const page = await context.newPage();
    page.setDefaultTimeout(60000);

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate to search page
    try {
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      logger.info("LinkedIn page navigation successful");
    } catch (error) {
      logger.error(`LinkedIn navigation failed: ${error.message}`);
      await browser.close();
      return res.status(500).json({
        message: `Failed to load LinkedIn page: ${error.message}`,
      });
    }

    // Wait for initial content
    await page.waitForTimeout(5000);

    // Check if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes("login") || currentUrl.includes("challenge")) {
      logger.warn("Redirected to login page - session may have expired");
      await browser.close();
      return res.status(401).json({
        message: "Session expired. Please reconnect your LinkedIn account.",
      });
    }

    // Wait for job cards to appear - LinkedIn uses different selectors
    try {
      // Try multiple selectors as LinkedIn may use different ones
      await page.waitForSelector(
        ".jobs-search-results__list-item, .jobs-search__results-list li, .scaffold-layout__list-item",
        { timeout: 20000 }
      );
      logger.info("Job cards selector found on LinkedIn page");
    } catch (error) {
      logger.warn(`LinkedIn job cards selector not found: ${error.message}`);
      await browser.close();
      return res.status(200).json({
        message:
          "No job cards found. The page structure may have changed or no jobs available.",
        data: [],
        total: 0,
      });
    }

    // Scroll page fully to load all job cards
    logger.info("Scrolling LinkedIn page to load all job cards...");
    await scrollLinkedInPageToLoadAllJobs(page);
    logger.info("Finished scrolling LinkedIn page");

    // Extract all job cards with detailed information - only Easy Apply jobs
    const allJobs = await page.evaluate(() => {
      // Try multiple selectors for job cards
      const jobCards = document.querySelectorAll(
        ".jobs-search-results__list-item, .jobs-search__results-list li, .scaffold-layout__list-item"
      );
      const jobs = [];

      jobCards.forEach((card, index) => {
        try {
          // Check if this is an Easy Apply job - LinkedIn filters should already handle this, but double check
          const cardText = card.innerText || card.textContent || "";
          const hasEasyApply =
            cardText.includes("Easy Apply") ||
            card.querySelector('[aria-label*="Easy Apply" i]') ||
            card.querySelector('span[class*="easy-apply" i]') ||
            card.querySelector('button[aria-label*="Easy Apply" i]');

          // Since we're using f_AL=true filter, all jobs should be Easy Apply
          // But we can still check to be safe

          // Get job title and link - try multiple selectors
          let titleElement =
            card.querySelector(".job-card-list__title") ||
            card.querySelector(".base-search-card__title") ||
            card.querySelector("a[data-control-name='job_card_title']") ||
            card.querySelector("a.job-card-list__title-link") ||
            card.querySelector(".job-card-list__title a");

          if (!titleElement) {
            // Try to find any link that might be the job link
            const linkElement = card.querySelector("a[href*='/jobs/view/']");
            if (!linkElement) return;
            titleElement = linkElement;
          }

          const jobLink = titleElement.getAttribute("href") || "";
          const fullJobLink =
            jobLink && jobLink.startsWith("http")
              ? jobLink
              : jobLink
                ? `https://www.linkedin.com${jobLink}`
                : "";

          // Extract job ID from URL
          const jobIdMatch =
            jobLink.match(/\/view\/(\d+)/) ||
            jobLink.match(/jobId=(\d+)/) ||
            jobLink.match(/jobs\/view\/(\d+)/);
          const jobId = jobIdMatch ? jobIdMatch[1] : `linkedin-job-${index}`;

          // Get company name - try multiple selectors
          const companyElement =
            card.querySelector(".job-card-container__primary-description") ||
            card.querySelector(".base-search-card__subtitle") ||
            card.querySelector(
              "a[data-control-name='job_card_company_link']"
            ) ||
            card.querySelector(".job-card-container__company-name") ||
            card.querySelector("h4.base-search-card__subtitle a");
          const companyName = companyElement
            ? companyElement.innerText.trim()
            : "";

          // Get location - try multiple selectors
          const locationElement =
            card.querySelector(".job-card-container__metadata-item") ||
            card.querySelector(".job-search-card__location") ||
            card.querySelector(
              ".job-card-list__metadata-wrapper .job-card-container__metadata-item"
            ) ||
            card.querySelector(
              ".job-card-container__metadata-wrapper .job-card-container__metadata-item"
            );
          const location = locationElement
            ? locationElement.innerText.trim()
            : "";

          // Get posted date/time
          const dateElement =
            card.querySelector(".job-card-container__metadata-wrapper time") ||
            card.querySelector("time[datetime]") ||
            card.querySelector(".job-card-container__metadata-item time");
          const postedDate = dateElement
            ? dateElement.getAttribute("datetime") ||
              dateElement.innerText.trim()
            : "";

          // Get job title text
          const jobTitle = titleElement.innerText.trim();

          jobs.push({
            jobId,
            jobTitle,
            companyName,
            location,
            postedDate,
            jobLink: fullJobLink,
            isEasyApply: true, // All scraped jobs should be Easy Apply due to f_AL=true filter
          });
        } catch (error) {
          console.error(`Error processing LinkedIn job card ${index}:`, error);
        }
      });

      return jobs;
    });

    logger.info(`LinkedIn Easy Apply jobs found: ${allJobs.length}`);

    await browser.close();

    // Delete old LinkedIn jobs for this user (identified by source or URL pattern)
    await Job.deleteMany({
      userId,
      applied: false,
      jobUrl: { $regex: /linkedin\.com/ },
    });
    logger.info(`Deleted old LinkedIn jobs for user ${userId}`);

    // Save new jobs
    if (allJobs.length > 0) {
      const jobsToSave = allJobs.map((job) => ({
        title: job.jobTitle || "Untitled Job",
        companyName: job.companyName || "Unknown Company",
        location: job.location || "",
        experience: "",
        salary: "",
        postedDate: job.postedDate || "",
        jobUrl: job.jobLink || "",
        jobId: job.jobId || "",
        applyButtonSelector: "", // LinkedIn Easy Apply button selector
        userId,
        postedAt: new Date(),
        applied: false,
        isEasyApply: true, // All scraped jobs are Easy Apply
      }));

      const savedJobs = await Job.insertMany(jobsToSave);
      logger.info(
        `Saved ${savedJobs.length} LinkedIn jobs for user: ${userId}`
      );

      res.status(200).json({
        message: "LinkedIn jobs scraped and saved successfully",
        data: savedJobs,
        total: savedJobs.length,
      });
    } else {
      logger.warn(`No LinkedIn Easy Apply jobs found for user ${userId}`);
      res.status(200).json({
        message:
          "No LinkedIn Easy Apply jobs found. Try a different job title or check your search filters.",
        data: [],
        total: 0,
      });
    }
  } catch (error) {
    logger.error("Error scraping LinkedIn jobs", error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({
      message: "Failed to scrape LinkedIn jobs",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

module.exports = {
  scrapeUserJobs,
  scrapeLinkedInJobs,
  getUserJobs,
  applyToJob,
  autoApplyJobs,
  getAppliedJobs,
};
