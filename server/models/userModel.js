const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      // Not required if using Google Auth only
    },
    googleId: {
      type: String,
      sparse: true, // Allows multiple nulls but enforces uniqueness when present
    },
    onboardingStatus: {
      type: String,
      enum: ["initial", "profile_completed", "naukri_connected", "completed"],
      default: "initial",
    },

    // Step 1: Basic Info
    fullName: { type: String },
    phone: { type: String },
    location: { type: String },

    // Step 2: Current Position
    currentJobTitle: { type: String },
    currentCompany: { type: String },
    currentLPA: { type: Number },
    yearsOfExperience: { type: Number },

    // Step 3: Job Preferences
    targetJobTitle: { type: String },
    expectedLPA: { type: Number },
    preferredLocations: [{ type: String }],
    jobType: {
      type: String,
      enum: ["full-time", "remote", "hybrid", "contract"],
    },

    // Step 4: Skills & Resume (optional fields)
    skills: [{ type: String }],
    resumeUrl: { type: String },
    linkedinUrl: { type: String },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash") || !this.passwordHash) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model("User", userSchema);
module.exports = User;
