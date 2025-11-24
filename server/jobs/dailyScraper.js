const cron = require("node-cron");
const User = require("../models/userModel");
const UserProfile = require("../models/userProfileModel");
const NaukriSession = require("../models/naukriSessionModel");
const logger = require("../utils/logger");

// Import your scraping logic
const { scrapeUserJobs } = require("../controllers/jobController");

// Run daily at 8 AM
cron.schedule("0 8 * * *", async () => {
  logger.info("Starting daily job scraping for all users");

  try {
    // Get all users with completed profiles and connected Naukri
    const users = await User.find({
      onboardingStatus: { $in: ["naukri_connected", "completed"] },
    });

    for (const user of users) {
      try {
        const profile = await UserProfile.findOne({ userId: user._id });
        const session = await NaukriSession.findOne({ userId: user._id });

        if (profile && session && session.expiresAt > new Date()) {
          // Set req.userId for the controller
          const mockReq = { userId: user._id };
          const mockRes = {
            status: (code) => ({
              json: (data) => {
                logger.info(`Scraped jobs for user ${user._id}: ${data.total || 0} jobs`);
              },
            }),
          };

          await scrapeUserJobs(mockReq, mockRes);
        }
      } catch (error) {
        logger.error(`Failed to scrape jobs for user ${user._id}`, error);
      }
    }

    logger.info("Daily job scraping completed");
  } catch (error) {
    logger.error("Error in daily scraping cron job", error);
  }
});

module.exports = {};
