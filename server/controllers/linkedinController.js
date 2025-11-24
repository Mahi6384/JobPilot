const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const LinkedInSession = require("../models/linkedinSessionModel");
const User = require("../models/userModel");
const logger = require("../utils/logger");

// Store active browser instances by userId for LinkedIn
const activeLinkedInBrowsers = new Map();

// Store session capture status by userId for LinkedIn
const linkedInSessionCaptureStatus = new Map();

// Helper function to check if user is logged in on LinkedIn
const checkLinkedInLoginStatus = async (page) => {
  try {
    const currentUrl = page.url();

    // Check URL first - if on feed or home, likely logged in
    if (
      currentUrl.includes("linkedin.com/feed") ||
      currentUrl.includes("linkedin.com/in/") ||
      currentUrl.includes("linkedin.com/mynetwork")
    ) {
      return true;
    }

    // Check for login indicators
    const loginIndicators = [
      "[data-control-name='nav.settings']",
      "[data-control-name='nav.messaging']",
      ".global-nav__me",
      "[data-control-name='nav.profile']",
      "text=Messaging",
      "text=Me",
    ];

    for (const selector of loginIndicators) {
      try {
        if (selector.startsWith("text=")) {
          const text = selector.replace("text=", "");
          const bodyText = await page.textContent("body");
          if (bodyText && bodyText.includes(text)) {
            return true;
          }
        } else {
          const element = await page.$(selector);
          if (element) {
            return true;
          }
        }
      } catch (e) {
        // Continue checking other selectors
      }
    }

    // Check cookies - if we have session cookies, likely logged in
    const cookies = await page.context().cookies();
    const hasSessionCookies = cookies.some(
      (cookie) =>
        cookie.name.includes("li_at") ||
        cookie.name.includes("JSESSIONID") ||
        cookie.name.includes("bcookie")
    );

    return hasSessionCookies;
  } catch (error) {
    logger.debug("Error checking LinkedIn login status", error);
    return false;
  }
};

// Helper function to automatically capture LinkedIn session
const autoCaptureLinkedInSession = async (userId, browser, context, page) => {
  try {
    logger.info(
      `Starting automatic LinkedIn session capture monitoring for user: ${userId}`
    );

    // Set initial status
    linkedInSessionCaptureStatus.set(userId, {
      status: "monitoring",
      message: "Waiting for login...",
    });

    let checkCount = 0;
    const maxChecks = 300; // Monitor for 25 minutes (300 * 5 seconds)
    const checkInterval = 5000; // Check every 5 seconds

    const checkLogin = async () => {
      try {
        // Check if browser is still open
        if (!browser.isConnected() || page.isClosed()) {
          linkedInSessionCaptureStatus.set(userId, {
            status: "failed",
            message: "Browser was closed",
          });
          return;
        }

        checkCount++;

        // Get current URL
        const currentUrl = page.url();

        // Check if logged in
        const isLoggedIn = await checkLinkedInLoginStatus(page);

        if (isLoggedIn) {
          logger.info(
            `LinkedIn login detected for user: ${userId}, capturing session...`
          );

          linkedInSessionCaptureStatus.set(userId, {
            status: "capturing",
            message: "Capturing session...",
          });

          // Save storage state
          const userDataDir = path.join(
            __dirname,
            "../browser-data",
            `linkedin-${userId.toString()}`
          );
          if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
          }
          await context.storageState({
            path: path.join(userDataDir, "state.json"),
          });

          // Get cookies
          const cookies = await context.cookies();
          const cookiesJson = JSON.stringify(cookies);

          // Calculate expiration
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          // Save session
          let session = await LinkedInSession.findOne({ userId });
          if (session) {
            session.cookiesEncrypted = cookiesJson;
            session.expiresAt = expiresAt;
            await session.save();
          } else {
            session = new LinkedInSession({
              userId,
              cookiesEncrypted: cookiesJson,
              expiresAt,
            });
            await session.save();
          }

          // Verify session was actually saved to database
          const savedSession = await LinkedInSession.findOne({ userId });
          if (!savedSession || !savedSession.cookiesEncrypted) {
            throw new Error("Failed to save session to database");
          }

          // Update user onboarding status (optional - could add linkedin_connected status)
          await User.findByIdAndUpdate(userId, {
            $set: { linkedinConnected: true },
          });

          // Close browser
          await browser.close();
          activeLinkedInBrowsers.delete(userId);

          // Clear capture status - the session is now stored in DB, status check will read from DB
          linkedInSessionCaptureStatus.delete(userId);

          logger.info(
            `Automatic LinkedIn session capture successful for user: ${userId}, session stored in database`
          );
          return;
        }

        // If not logged in and haven't exceeded max checks, continue monitoring
        if (checkCount < maxChecks) {
          linkedInSessionCaptureStatus.set(userId, {
            status: "monitoring",
            message: `Waiting for login... (${checkCount}/${maxChecks})`,
          });
          setTimeout(checkLogin, checkInterval);
        } else {
          // Timeout
          linkedInSessionCaptureStatus.set(userId, {
            status: "timeout",
            message: "Login timeout. Please try again.",
          });
          logger.warn(`LinkedIn session capture timeout for user: ${userId}`);
        }
      } catch (error) {
        logger.error("Error in LinkedIn auto capture check", error);
        linkedInSessionCaptureStatus.set(userId, {
          status: "error",
          message: "Error monitoring login status",
        });
      }
    };

    // Start monitoring after a short delay
    setTimeout(checkLogin, 2000);

    // Also listen for navigation events
    const navigationHandler = async (frame) => {
      if (frame === page.mainFrame()) {
        // Check login status on navigation
        setTimeout(async () => {
          try {
            const currentStatus = linkedInSessionCaptureStatus.get(userId);
            if (currentStatus && currentStatus.status === "monitoring") {
              const isLoggedIn = await checkLinkedInLoginStatus(page);
              if (isLoggedIn) {
                // Stop listening to avoid duplicate captures
                page.off("framenavigated", navigationHandler);
              }
            }
          } catch (error) {
            logger.debug("Error in LinkedIn navigation handler", error);
          }
        }, 2000);
      }
    };

    page.on("framenavigated", navigationHandler);
  } catch (error) {
    logger.error("Error in auto capture LinkedIn session", error);
    linkedInSessionCaptureStatus.set(userId, {
      status: "error",
      message: "Failed to start monitoring",
    });
  }
};

// Start LinkedIn connection process
const startLinkedInConnection = async (req, res) => {
  let browser;
  let context;
  try {
    const userId = req.userId;

    // Always allow connection/reconnection - don't block if session exists
    // This allows users to reconnect and store new sessions

    // Reset capture status
    linkedInSessionCaptureStatus.delete(userId);

    // Close any existing browser for this user
    if (activeLinkedInBrowsers.has(userId)) {
      try {
        const existingBrowser = activeLinkedInBrowsers.get(userId);
        if (existingBrowser.browser && existingBrowser.browser.isConnected()) {
          await existingBrowser.browser.close();
        }
        activeLinkedInBrowsers.delete(userId);
      } catch (error) {
        logger.warn("Error closing existing LinkedIn browser", error);
      }
    }

    // Create user-specific browser context directory
    const userDataDir = path.join(
      __dirname,
      "../browser-data",
      `linkedin-${userId.toString()}`
    );

    // Ensure directory exists
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    // Launch browser with persistent context
    browser = await chromium.launch({
      headless: false,
      slowMo: 500,
    });

    // Create context with persistent storage
    context = await browser.newContext({
      storageState: fs.existsSync(path.join(userDataDir, "state.json"))
        ? path.join(userDataDir, "state.json")
        : undefined,
    });

    const page = await context.newPage();

    // Navigate to LinkedIn login
    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "networkidle",
    });

    // Store browser and context for monitoring
    activeLinkedInBrowsers.set(userId, { browser, context, page });

    // Start automatic monitoring
    autoCaptureLinkedInSession(userId, browser, context, page);

    logger.info(
      `LinkedIn connection started for user: ${userId}, monitoring for login...`
    );

    res.status(200).json({
      message:
        "Browser opened. Please log in to LinkedIn. Your session will be captured automatically once you log in.",
      browserLaunched: true,
      monitoring: true,
    });
  } catch (error) {
    logger.error("LinkedIn connection error", error);
    // Clean up on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        logger.warn("Error closing browser on error", closeError);
      }
    }
    if (activeLinkedInBrowsers.has(req.userId)) {
      activeLinkedInBrowsers.delete(req.userId);
    }
    linkedInSessionCaptureStatus.delete(req.userId);
    res.status(500).json({
      message: "Failed to start LinkedIn connection",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get LinkedIn connection status
const getLinkedInConnectionStatus = async (req, res) => {
  try {
    const userId = req.userId;

    // Always check database first for actual session status
    const session = await LinkedInSession.findOne({ userId });

    // Check if there's an active capture process
    const captureStatus = linkedInSessionCaptureStatus.get(userId);

    // Only return connected: true if session actually exists in database and is not expired
    let isConnected = false;
    if (session) {
      const isExpired = session.expiresAt < new Date();
      isConnected = !isExpired;
    }

    // If monitoring, return monitoring status
    if (captureStatus) {
      return res.status(200).json({
        connected: isConnected, // Only true if session exists in DB
        monitoring:
          captureStatus.status === "monitoring" ||
          captureStatus.status === "capturing",
        captureStatus: captureStatus.status,
        message: captureStatus.message,
        expiresAt: session?.expiresAt,
      });
    }

    // No monitoring, just return session status from database
    res.status(200).json({
      connected: isConnected,
      expiresAt: session?.expiresAt,
      monitoring: false,
    });
  } catch (error) {
    logger.error("Get LinkedIn connection status error", error);
    res.status(500).json({
      message: "Failed to get connection status",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Cleanup function to close all active LinkedIn browsers
const cleanupLinkedInBrowsers = async () => {
  logger.info("Cleaning up active LinkedIn browsers...");
  for (const [userId, { browser }] of activeLinkedInBrowsers.entries()) {
    try {
      if (browser && browser.isConnected()) {
        await browser.close();
      }
    } catch (error) {
      logger.warn(`Error closing LinkedIn browser for user ${userId}`, error);
    }
  }
  activeLinkedInBrowsers.clear();
  logger.info("All LinkedIn browsers cleaned up");
};

// Handle process termination
process.on("SIGINT", async () => {
  await cleanupLinkedInBrowsers();
});

process.on("SIGTERM", async () => {
  await cleanupLinkedInBrowsers();
});

module.exports = {
  startLinkedInConnection,
  getLinkedInConnectionStatus,
  cleanupLinkedInBrowsers,
};
