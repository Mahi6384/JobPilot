const express = require("express");
const {
  storeScrapedJobs,
  getAllJobs,
} = require("../controllers/jobController");
const router = express.Router();
router.post("/scrape", storeScrapedJobs);
router.get("/", getAllJobs);
module.exports = router;
