const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
  getOnboardingStatus,
  saveStep,
  getProfile,
  updateProfile,
} = require("../controllers/onboardingController");

// All routes require authentication
router.use(authenticate);

// Get onboarding status and current step
router.get("/status", getOnboardingStatus);

// Save data for a specific step (1-4)
router.put("/step/:stepNumber", saveStep);

// Get full user profile
router.get("/profile", getProfile);

// Update full profile
router.put("/profile", updateProfile);

module.exports = router;
