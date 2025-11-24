const express = require("express");
const {
  scrapeUserJobs,
  scrapeLinkedInJobs,
  getUserJobs,
  applyToJob,
  autoApplyJobs,
  getAppliedJobs,
} = require("../controllers/jobController");
const { authenticate } = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/scrape", authenticate, scrapeUserJobs);
router.post("/scrape-linkedin", authenticate, scrapeLinkedInJobs);
router.get("/", authenticate, getUserJobs);
router.post("/:jobId/apply", authenticate, applyToJob);
router.post("/auto-apply", authenticate, autoApplyJobs);
router.get("/applied", authenticate, getAppliedJobs);

module.exports = router;
