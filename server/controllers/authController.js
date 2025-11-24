const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "your-secret-key", {
    expiresIn: "7d",
  });
};

const signup = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    // Create user
    const user = new User({
      email,
      passwordHash: password, // Will be hashed by pre-save hook
      onboardingStatus: "initial",
    });

    await user.save();

    const token = generateToken(user._id);

    logger.info(`New user signed up: ${email}`);
    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        onboardingStatus: user.onboardingStatus,
      },
    });
  } catch (error) {
    logger.error("Signup error", error);
    res.status(500).json({
      message: "Failed to create user",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    if (!user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    logger.info(`User logged in: ${email}`);
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        onboardingStatus: user.onboardingStatus,
      },
    });
  } catch (error) {
    logger.error("Login error", error);
    res.status(500).json({
      message: "Failed to login",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

// Google Auth (simplified - you'll need to integrate with Google OAuth)
const googleAuth = async (req, res) => {
  try {
    const { email, googleId, name } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({ message: "Email and Google ID are required" });
    }

    // Find or create user
    let user = await User.findOne({ $or: [{ email }, { googleId }] });

    if (!user) {
      user = new User({
        email,
        googleId,
        onboardingStatus: "initial",
      });
      await user.save();
    } else if (!user.googleId) {
      // Link Google account to existing user
      user.googleId = googleId;
      await user.save();
    }

    const token = generateToken(user._id);

    logger.info(`Google auth successful: ${email}`);
    res.status(200).json({
      message: "Google authentication successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        onboardingStatus: user.onboardingStatus,
      },
    });
  } catch (error) {
    logger.error("Google auth error", error);
    res.status(500).json({
      message: "Failed to authenticate with Google",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

module.exports = {
  signup,
  login,
  googleAuth,
};
