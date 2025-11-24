const express = require("express");
const {
  startNaukriConnection,
  captureNaukriSession,
  getConnectionStatus,
} = require("../controllers/naukriController");
const { authenticate } = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/connect", authenticate, startNaukriConnection);
router.post("/capture-session", authenticate, captureNaukriSession);
router.get("/status", authenticate, getConnectionStatus);

module.exports = router;
