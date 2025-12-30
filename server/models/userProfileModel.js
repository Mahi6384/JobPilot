const mongoose = require("mongoose");

const userProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    currentCity: {
      type: String,
      trim: true,
    },
    remotePreference: {
      type: Boolean,
      default: false,
    },
    experience: {
      type: String,
      required: true,
    },
    skills: {
      type: [String],
      required: true,
      default: [],
    },
    preferredRoles: {
      type: [String],
      required: true,
      default: [],
    },
    jobType: {
      type: String,
      enum: ["Full-time", "Internship", ""],
      default: "",
    },
    workMode: {
      type: String,
      enum: ["Remote", "Hybrid", "Onsite", ""],
      default: "",
    },
    expectedCTC: {
      type: String,
      default: "",
    },
    resumePath: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const UserProfile = mongoose.model("UserProfile", userProfileSchema);
module.exports = UserProfile;
