const UserProfile = require("../models/userProfileModel");
const User = require("../models/userModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

// Configure multer for resume upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/resumes");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      `resume-${req.userId}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".pdf", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, and DOCX files are allowed"));
    }
  },
}).single("resume");

const createOrUpdateProfile = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      try {
        const {
          name,
          experience,
          skills,
          preferredRoles,
          preferredLocations,
          expectedCTC,
        } = req.body;

        if (
          !name ||
          !experience ||
          !skills ||
          !preferredRoles ||
          !preferredLocations
        ) {
          return res
            .status(400)
            .json({ message: "All required fields must be provided" });
        }

        // Parse arrays if they come as strings
        const skillsArray = Array.isArray(skills)
          ? skills
          : skills
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s);
        const rolesArray = Array.isArray(preferredRoles)
          ? preferredRoles
          : preferredRoles
              .split(",")
              .map((r) => r.trim())
              .filter((r) => r);
        const locationsArray = Array.isArray(preferredLocations)
          ? preferredLocations
          : preferredLocations
              .split(",")
              .map((l) => l.trim())
              .filter((l) => l);

        const resumePath = req.file ? req.file.path : "";

        // Check if profile exists
        let profile = await UserProfile.findOne({ userId: req.userId });

        if (profile) {
          // Update existing profile
          profile.name = name;
          profile.experience = experience;
          profile.skills = skillsArray;
          profile.preferredRoles = rolesArray;
          profile.preferredLocations = locationsArray;
          profile.expectedCTC = expectedCTC || "";
          if (resumePath) {
            // Delete old resume if exists
            if (profile.resumePath && fs.existsSync(profile.resumePath)) {
              fs.unlinkSync(profile.resumePath);
            }
            profile.resumePath = resumePath;
          }
          await profile.save();
        } else {
          // Create new profile
          profile = new UserProfile({
            userId: req.userId,
            name,
            experience,
            skills: skillsArray,
            preferredRoles: rolesArray,
            preferredLocations: locationsArray,
            expectedCTC: expectedCTC || "",
            resumePath,
          });
          await profile.save();
        }

        // Update user onboarding status
        await User.findByIdAndUpdate(req.userId, {
          onboardingStatus: "profile_completed",
        });

        logger.info(
          `Profile ${profile ? "updated" : "created"} for user: ${req.userId}`
        );

        res.status(200).json({
          message: "Profile saved successfully",
          profile: {
            name: profile.name,
            experience: profile.experience,
            skills: profile.skills,
            preferredRoles: profile.preferredRoles,
            preferredLocations: profile.preferredLocations,
            expectedCTC: profile.expectedCTC,
            resumePath: profile.resumePath,
          },
        });
      } catch (error) {
        logger.error("Profile creation/update error", error);
        res.status(500).json({
          message: "Failed to save profile",
          error:
            process.env.NODE_ENV === "development"
              ? error.message
              : "Internal server error",
        });
      }
    });
  } catch (error) {
    logger.error("Profile upload error", error);
    res.status(500).json({
      message: "Failed to process profile",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ userId: req.userId });

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.status(200).json({
      message: "Profile retrieved successfully",
      profile,
    });
  } catch (error) {
    logger.error("Get profile error", error);
    res.status(500).json({
      message: "Failed to retrieve profile",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

module.exports = {
  createOrUpdateProfile,
  getProfile,
};
