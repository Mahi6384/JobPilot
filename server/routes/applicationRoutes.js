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
router.post("/batch", createBatchApplications);
router.get("/", getApplications);
router.get("/stats", getApplicationStats);
router.patch("/:id/status", updateApplicationStatus);

module.exports = router;
