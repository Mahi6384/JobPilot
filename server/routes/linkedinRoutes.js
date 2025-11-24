const express = require("express");
const {
  startLinkedInConnection,
  getLinkedInConnectionStatus,
} = require("../controllers/linkedinController");
const { authenticate } = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/connect", authenticate, startLinkedInConnection);
router.get("/status", authenticate, getLinkedInConnectionStatus);

module.exports = router;

