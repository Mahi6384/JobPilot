const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { generateAnswer } = require("../controllers/aiController");

const router = express.Router();

router.use(authenticate);

router.post("/generate-answer", generateAnswer);

module.exports = router;

