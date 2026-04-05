const express = require("express");
const router = express.Router();

const {
  getMatchedJobs,
  getJobFilters,
  getJobById,
  getDashboardData,
  getJobSearchStatus,
} = require("../controllers/jobController");
const { authenticate } = require("../middleware/authMiddleware");

router.use(authenticate);

router.get("/filters", getJobFilters);
router.get("/dashboard", getDashboardData);
router.get("/search-status", getJobSearchStatus);
router.get("/:id", getJobById);
router.get("/", getMatchedJobs);

module.exports = router;