const express = require("express");
const router = express.Router();
const {
  createBatchApplications,
  getApplications,
  getApplicationStats,
  updateApplicationStatus,
  retryApplication,
} = require("../controllers/applicationController");
const { authenticate } = require("../middleware/authMiddleware");

router.use(authenticate);

router.post("/batch", createBatchApplications);
router.get("/stats", getApplicationStats);
router.patch("/:id/status", updateApplicationStatus);
router.post("/:id/retry", retryApplication);
router.get("/", getApplications);

module.exports = router;
