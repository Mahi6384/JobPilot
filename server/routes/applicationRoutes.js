const express = require("express");
const router = express.Router();
const {
  createBatchApplications,
  getApplications,
  getApplicationStats,
  updateApplicationStatus,
} = require("../controllers/applicationController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

// Specific routes MUST come before generic routes
router.post("/batch", createBatchApplications);
router.get("/stats", getApplicationStats);
router.patch("/:id/status", updateApplicationStatus);

// Generic route comes last
router.get("/", getApplications);

module.exports = router;
