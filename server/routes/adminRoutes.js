const express = require("express");
const router = express.Router();

const { authenticate, requireAdmin } = require("../middleware/authMiddleware");
const { getOverview } = require("../controllers/adminController");

router.use(authenticate);
router.use(requireAdmin);

router.get("/ping", (req, res) => {
  res.status(200).json({ success: true });
});

router.get("/overview", getOverview);

module.exports = router;

