const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const logger = require("../utils/logger");

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    logger.error("Authentication error", error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = { authenticate };
