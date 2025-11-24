const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const NaukriSession = require("../models/naukriSessionModel");
const User = require("../models/userModel");
const logger = require("../utils/logger");

// Store active browser instances by userId
const activeBrowsers = new Map();

// Store session capture status by userId
const sessionCaptureStatus = new Map();

// Helper function to check if user is logged in on a page
const checkLoginStatus = async (page) => {
  try {
    const currentUrl = page.url();

    // Check URL first - if on homepage or dashboard, likely logged in
    if (currentUrl.includes("mnjuser") || currentUrl.includes("homepage")) {
      return true;
    }

    // Check for login indicators
    const loginIndicators = [
      ".user-name",
      ".nI-gNb-drawer__user-name",
      "[data-testid='user-name']",
      ".nI-gNb-header__user-name",
      "text=My Naukri",
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
        cookie.name.includes("session") ||
        cookie.name.includes("auth") ||
        cookie.name.includes("token")
    );

    return hasSessionCookies;
  } catch (error) {
    logger.debug("Error checking login status", error);
    return false;
  }
};

// Helper function to automatically capture session
const autoCaptureSession = async (userId, browser, context, page) => {
  try {
    logger.info(
      `Starting automatic session capture monitoring for user: ${userId}`
    );

    // Set initial status
    sessionCaptureStatus.set(userId, {
      status: "monitoring",
      message: "Waiting for login...",
    });

    let checkCount = 0;
    const maxChecks = 120; // Monitor for 10 minutes (120 * 5 seconds)
    const checkInterval = 5000; // Check every 5 seconds

    const checkLogin = async () => {
      try {
        // Check if browser is still open
        if (!browser.isConnected() || page.isClosed()) {
          sessionCaptureStatus.set(userId, {
            status: "failed",
            message: "Browser was closed",
          });
          return;
        }

        checkCount++;

        // Get current URL
        const currentUrl = page.url();

        // Check if logged in
        const isLoggedIn = await checkLoginStatus(page);

        if (isLoggedIn) {
          logger.info(
            `Login detected for user: ${userId}, capturing session...`
          );

          sessionCaptureStatus.set(userId, {
            status: "capturing",
            message: "Capturing session...",
          });

          // Save storage state
          const userDataDir = path.join(
            __dirname,
            "../browser-data",
            userId.toString()
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
          let session = await NaukriSession.findOne({ userId });
          if (session) {
            session.cookiesEncrypted = cookiesJson;
            session.expiresAt = expiresAt;
            await session.save();
          } else {
            session = new NaukriSession({
              userId,
              cookiesEncrypted: cookiesJson,
              expiresAt,
            });
            await session.save();
          }

          // Verify session was actually saved to database
          const savedSession = await NaukriSession.findOne({ userId });
          if (!savedSession || !savedSession.cookiesEncrypted) {
            throw new Error("Failed to save session to database");
          }

          // Update user onboarding status
          await User.findByIdAndUpdate(userId, {
            onboardingStatus: "naukri_connected",
          });

          // Close browser
          await browser.close();
          activeBrowsers.delete(userId);

          // Clear capture status - the session is now stored in DB, status check will read from DB
          sessionCaptureStatus.delete(userId);

          logger.info(
            `Automatic session capture successful for user: ${userId}, session stored in database`
          );
          return;
        }

        // If not logged in and haven't exceeded max checks, continue monitoring
        if (checkCount < maxChecks) {
          sessionCaptureStatus.set(userId, {
            status: "monitoring",
            message: `Waiting for login... (${checkCount}/${maxChecks})`,
          });
          setTimeout(checkLogin, checkInterval);
        } else {
          // Timeout
          sessionCaptureStatus.set(userId, {
            status: "timeout",
            message: "Login timeout. Please try again.",
          });
          logger.warn(`Session capture timeout for user: ${userId}`);
        }
      } catch (error) {
        logger.error("Error in auto capture check", error);
        sessionCaptureStatus.set(userId, {
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
            const currentStatus = sessionCaptureStatus.get(userId);
            if (currentStatus && currentStatus.status === "monitoring") {
              const isLoggedIn = await checkLoginStatus(page);
              if (isLoggedIn) {
                // Stop listening to avoid duplicate captures
                page.off("framenavigated", navigationHandler);
                // The main checkLogin loop will handle the capture
              }
            }
          } catch (error) {
            logger.debug("Error in navigation handler", error);
          }
        }, 2000);
      }
    };

    page.on("framenavigated", navigationHandler);
  } catch (error) {
    logger.error("Error in auto capture session", error);
    sessionCaptureStatus.set(userId, {
      status: "error",
      message: "Failed to start monitoring",
    });
  }
};

// Start Naukri connection process
const startNaukriConnection = async (req, res) => {
  let browser;
  let context;
  try {
    const userId = req.userId;

    // Always allow connection/reconnection - don't block if session exists
    // This allows users to reconnect and store new sessions

    // Reset capture status
    sessionCaptureStatus.delete(userId);

    // Close any existing browser for this user
    if (activeBrowsers.has(userId)) {
      try {
        const existingBrowser = activeBrowsers.get(userId);
        if (existingBrowser.browser && existingBrowser.browser.isConnected()) {
          await existingBrowser.browser.close();
        }
        activeBrowsers.delete(userId);
      } catch (error) {
        logger.warn("Error closing existing browser", error);
      }
    }

    // Create user-specific browser context directory
    const userDataDir = path.join(
      __dirname,
      "../browser-data",
      userId.toString()
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

    // Navigate to Naukri login
    await page.goto("https://www.naukri.com/nlogin/login", {
      waitUntil: "networkidle",
    });

    // Store browser and context for monitoring
    activeBrowsers.set(userId, { browser, context, page });

    // Start automatic monitoring
    autoCaptureSession(userId, browser, context, page);

    logger.info(
      `Naukri connection started for user: ${userId}, monitoring for login...`
    );

    res.status(200).json({
      message:
        "Browser opened. Please log in to Naukri. Your session will be captured automatically once you log in.",
      browserLaunched: true,
      monitoring: true,
    });
  } catch (error) {
    logger.error("Naukri connection error", error);
    // Clean up on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        logger.warn("Error closing browser on error", closeError);
      }
    }
    if (activeBrowsers.has(req.userId)) {
      activeBrowsers.delete(req.userId);
    }
    sessionCaptureStatus.delete(req.userId);
    res.status(500).json({
      message: "Failed to start Naukri connection",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Capture session after user logs in
const captureNaukriSession = async (req, res) => {
  let browser;
  let context;
  let page;
  try {
    const userId = req.userId;

    // Try to reuse the existing browser/context from startNaukriConnection
    const activeBrowser = activeBrowsers.get(userId);

    if (activeBrowser && activeBrowser.browser) {
      try {
        // Check if browser is still connected
        if (activeBrowser.browser.isConnected()) {
          // Reuse existing browser
          browser = activeBrowser.browser;
          context = activeBrowser.context;
          // Use existing page or create new one
          if (activeBrowser.page && !activeBrowser.page.isClosed()) {
            page = activeBrowser.page;
          } else {
            page = await context.newPage();
          }
          logger.info(`Reusing existing browser for user: ${userId}`);
        } else {
          // Browser was closed, remove from map
          activeBrowsers.delete(userId);
        }
      } catch (error) {
        // Browser might be invalid, remove from map
        logger.warn("Error checking browser connection", error);
        activeBrowsers.delete(userId);
      }
    }

    if (!browser) {
      // Launch new browser with persistent context
      const userDataDir = path.join(
        __dirname,
        "../browser-data",
        userId.toString()
      );

      browser = await chromium.launch({ headless: false });
      context = await browser.newContext({
        storageState: fs.existsSync(path.join(userDataDir, "state.json"))
          ? path.join(userDataDir, "state.json")
          : undefined,
      });
      page = await context.newPage();
    }

    // Navigate to a page that requires login to verify session
    await page.goto("https://www.naukri.com/mnjuser/homepage", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait a bit for page to fully load
    await page.waitForTimeout(2000);

    // Check if user is logged in by looking for user-specific elements
    const isLoggedIn =
      (await page.$(
        ".user-name, .nI-gNb-drawer__user-name, [data-testid='user-name']"
      )) !== null ||
      (await page.textContent("body"))?.includes("My Naukri") ||
      page.url().includes("mnjuser");

    if (!isLoggedIn) {
      // Check if we're on login page
      const isOnLoginPage =
        page.url().includes("nlogin") || page.url().includes("login");

      if (isOnLoginPage) {
        await browser.close();
        if (activeBrowsers.has(userId)) {
          activeBrowsers.delete(userId);
        }
        return res.status(400).json({
          message:
            "Please login to Naukri in the browser window that opened. After logging in, click 'Capture Session' again.",
        });
      }

      // Try to get cookies anyway (might be logged in but selector changed)
      const cookies = await context.cookies();
      if (cookies.length === 0) {
        await browser.close();
        if (activeBrowsers.has(userId)) {
          activeBrowsers.delete(userId);
        }
        return res.status(400).json({
          message:
            "No session found. Please login to Naukri first, then try again.",
        });
      }
    }

    // Save storage state (cookies, localStorage, etc.)
    const userDataDir = path.join(
      __dirname,
      "../browser-data",
      userId.toString()
    );
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    await context.storageState({ path: path.join(userDataDir, "state.json") });

    // Get cookies
    const cookies = await context.cookies();
    const cookiesJson = JSON.stringify(cookies);

    // Calculate expiration (typically 30 days for Naukri)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Save or update session
    let session = await NaukriSession.findOne({ userId });
    if (session) {
      session.cookiesEncrypted = cookiesJson;
      session.expiresAt = expiresAt;
      await session.save();
    } else {
      session = new NaukriSession({
        userId,
        cookiesEncrypted: cookiesJson,
        expiresAt,
      });
      await session.save();
    }

    // Update user onboarding status
    await User.findByIdAndUpdate(userId, {
      onboardingStatus: "naukri_connected",
    });

    // Close browser and clean up
    await browser.close();
    if (activeBrowsers.has(userId)) {
      activeBrowsers.delete(userId);
    }

    logger.info(`Naukri session captured for user: ${userId}`);

    res.status(200).json({
      message: "Naukri account connected successfully",
      connected: true,
    });
  } catch (error) {
    logger.error("Session capture error", error);
    // Clean up on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        logger.warn("Error closing browser on error", closeError);
      }
    }
    if (activeBrowsers.has(req.userId)) {
      activeBrowsers.delete(req.userId);
    }
    res.status(500).json({
      message:
        "Failed to capture session. Please make sure you're logged into Naukri.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get connection status (includes capture status)
const getConnectionStatus = async (req, res) => {
  try {
    const userId = req.userId;

    // Always check database first for actual session status
    const session = await NaukriSession.findOne({ userId });

    // Check if there's an active capture process
    const captureStatus = sessionCaptureStatus.get(userId);

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
    logger.error("Get connection status error", error);
    res.status(500).json({
      message: "Failed to get connection status",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Cleanup function to close all active browsers
const cleanupBrowsers = async () => {
  logger.info("Cleaning up active browsers...");
  for (const [userId, { browser }] of activeBrowsers.entries()) {
    try {
      if (browser && browser.isConnected()) {
        await browser.close();
      }
    } catch (error) {
      logger.warn(`Error closing browser for user ${userId}`, error);
    }
  }
  activeBrowsers.clear();
  logger.info("All browsers cleaned up");
};

// Handle process termination
process.on("SIGINT", async () => {
  await cleanupBrowsers();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await cleanupBrowsers();
  process.exit(0);
});

module.exports = {
  startNaukriConnection,
  captureNaukriSession,
  getConnectionStatus,
  cleanupBrowsers,
};
