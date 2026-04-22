const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const logger = require("../utils/logger");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "your-secret-key", {
    expiresIn: "7d",
  });
};

const signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

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
      fullName: name,
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
        fullName: user.fullName,
        onboardingStatus: user.onboardingStatus,
        isAdmin: user.isAdmin === true,
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
        fullName: user.fullName,
        onboardingStatus: user.onboardingStatus,
        isAdmin: user.isAdmin === true,
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

// Google Auth (securely verify ID token)
const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    // Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ message: "Google account must have an email" });
    }

    // Find or create user
    let user = await User.findOne({ $or: [{ email }, { googleId }] });

    if (!user) {
      user = new User({
        email,
        googleId,
        fullName: name,
        onboardingStatus: "initial",
      });
      await user.save();
      logger.info(`New user created via Google Auth: ${email}`);
    } else {
      let isUpdated = false;
      if (!user.googleId) {
        user.googleId = googleId;
        isUpdated = true;
      }
      if (isUpdated) {
        await user.save();
        logger.info(`Linked Google account to existing user: ${email}`);
      }
    }

    const token = generateToken(user._id);

    res.status(200).json({
      message: "Google authentication successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        onboardingStatus: user.onboardingStatus,
        isAdmin: user.isAdmin === true,
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

// Google Auth (extension): accept Google OAuth access token
const googleAuthAccessToken = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: "Google accessToken is required" });
    }

    // Validate access token and its audience (client_id)
    const tokenInfoResp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(
        accessToken
      )}`
    );
    const tokenInfo = await tokenInfoResp.json();
    if (!tokenInfoResp.ok) {
      return res.status(401).json({
        message: "Invalid Google access token",
        error:
          process.env.NODE_ENV === "development"
            ? tokenInfo?.error_description || tokenInfo?.error || "invalid_token"
            : "Unauthorized",
      });
    }

    const allowedAudience = process.env.GOOGLE_EXTENSION_CLIENT_ID;
    if (allowedAudience && tokenInfo.audience !== allowedAudience) {
      return res.status(401).json({ message: "Google token audience mismatch" });
    }

    // Fetch user profile (includes stable `sub`)
    const userInfoResp = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const userInfo = await userInfoResp.json();
    if (!userInfoResp.ok) {
      return res.status(401).json({ message: "Failed to fetch Google userinfo" });
    }

    const googleId = userInfo.sub;
    const email = userInfo.email;
    const name = userInfo.name;
    const picture = userInfo.picture;

    if (!email) {
      return res.status(400).json({ message: "Google account must have an email" });
    }

    // Find or create user
    let user = await User.findOne({ $or: [{ email }, { googleId }] });

    if (!user) {
      user = new User({
        email,
        googleId,
        fullName: name,
        onboardingStatus: "initial",
      });
      await user.save();
      logger.info(`New user created via Google access token: ${email}`);
    } else {
      let isUpdated = false;
      if (!user.googleId) {
        user.googleId = googleId;
        isUpdated = true;
      }
      if (!user.fullName && name) {
        user.fullName = name;
        isUpdated = true;
      }
      if (isUpdated) {
        await user.save();
        logger.info(`Linked Google account to existing user (access token): ${email}`);
      }
    }

    const token = generateToken(user._id);

    res.status(200).json({
      message: "Google authentication successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        onboardingStatus: user.onboardingStatus,
        isAdmin: user.isAdmin === true,
      },
    });
  } catch (error) {
    logger.error("Google access token auth error", error);
    res.status(500).json({
      message: "Failed to authenticate with Google",
      error:
        process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

module.exports = {
  signup,
  login,
  googleAuth,
  googleAuthAccessToken,
};
