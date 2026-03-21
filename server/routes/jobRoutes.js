const express = require("express");
const router = express.Router();

const { getMatchedJobsHandles, getJobFilters, getJobsById, getDashboardData, getJobSearchStatus } = require("../controllers/jobController");
const {authenticate} = require("../middleware/authMiddleware");
router.use(authenticate);

router.get("/filters", getJobFilters);
router.get("/dashboard", getDashboardData);
router.get("/search-status", getJobSearchStatus);
router.get("/:id", getJobsById);
router.get("/", getMatchedJobsHandles);             

module.exports = router;