const express = require("express");
const {
  signup,
  login,
  googleAuth,
  googleAuthAccessToken,
} = require("../controllers/authController");
const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/google/access-token", googleAuthAccessToken);

module.exports = router;
