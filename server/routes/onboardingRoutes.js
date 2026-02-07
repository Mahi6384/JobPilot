const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
  getOnboardingStatus,
  saveStep,
  getProfile,
} = require("../controllers/onboardingController");

// All routes require authentication
router.use(authenticate);

// Get onboarding status and current step
router.get("/status", getOnboardingStatus);

// Save data for a specific step (1-4)
router.put("/step/:stepNumber", saveStep);

// Get full user profile
router.get("/profile", getProfile);

module.exports = router;
