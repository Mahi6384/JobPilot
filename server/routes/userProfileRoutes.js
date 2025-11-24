const express = require("express");
const { createOrUpdateProfile, getProfile } = require("../controllers/userProfileController");
const { authenticate } = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/", authenticate, createOrUpdateProfile);
router.get("/", authenticate, getProfile);

module.exports = router;
