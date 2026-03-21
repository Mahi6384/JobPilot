const mongoose = require("mongoose");

const scrapeQuerySchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    source: {
      type: String,
      enum: ["onboarding", "manual"],
      default: "onboarding",
    },
    lastScrapedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const ScrapeQuery = mongoose.model("ScrapeQuery", scrapeQuerySchema);
module.exports = ScrapeQuery;
