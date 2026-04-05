const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
  getOnboardingStatus,
  saveStep,
  getProfile,
  getResumeData,
  updateProfile,
  parseResume,
} = require("../controllers/onboardingController");

const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(authenticate);

router.post("/parse-resume", upload.single("resume"), parseResume);
router.get("/status", getOnboardingStatus);
router.put("/step/:stepNumber", saveStep);
router.get("/profile", getProfile);
router.get("/resume-data", getResumeData);
router.put("/profile", updateProfile);

module.exports = router;
