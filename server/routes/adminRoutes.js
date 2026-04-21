const express = require("express");
const router = express.Router();

const { authenticate, requireAdmin } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(requireAdmin);

router.get("/ping", (req, res) => {
  res.status(200).json({ success: true });
});

module.exports = router;

