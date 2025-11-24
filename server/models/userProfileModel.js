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
    preferredLocations: {
      type: [String],
      required: true,
      default: [],
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
