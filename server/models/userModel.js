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
    jobSearchStatus: {
      type: String,
      enum: ["idle", "searching", "ready"],
      default: "idle",
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
    resumeFileStored: { type: Boolean, default: false },
    linkedinUrl: { type: String },

    // ── ATS Autofill Extended Profile (hybrid: user overrides + resume-derived) ──
    socials: {
      githubUrl: { type: String },
      portfolioUrl: { type: String },
      twitterUrl: { type: String },
    },

    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      region: { type: String }, // state/province
      country: { type: String },
      postalCode: { type: String },
    },

    workEligibility: {
      authorizedToWork: { type: String }, // Yes/No/Prefer not to say
      needsSponsorship: { type: String }, // Yes/No/Prefer not to say
      willingToRelocate: { type: String }, // Yes/No/Prefer not to say
    },

    // Structured entries used by ATSs (Workday especially)
    experienceEntries: [
      {
        company: { type: String },
        title: { type: String },
        location: { type: String },
        startMonth: { type: Number },
        startYear: { type: Number },
        endMonth: { type: Number },
        endYear: { type: Number },
        isCurrent: { type: Boolean, default: false },
        description: { type: String },
      },
    ],
    educationEntries: [
      {
        school: { type: String },
        degree: { type: String },
        fieldOfStudy: { type: String },
        startMonth: { type: Number },
        startYear: { type: Number },
        endMonth: { type: Number },
        endYear: { type: Number },
        gpa: { type: String },
      },
    ],

    eeo: {
      gender: { type: String },
      raceEthnicity: { type: String },
      veteranStatus: { type: String },
      disabilityStatus: { type: String },
    },

    isAdmin: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
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
