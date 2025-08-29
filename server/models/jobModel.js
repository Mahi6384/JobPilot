const mongoose = require("mongoose");
const jobCardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  experience: {
    type: String,
    required: true,
  },
});

const jobCard = mongoose.model("jobCard", jobCardSchema);
module.exports = jobCard;
