const mongoose = require("mongoose");
const User = require("./models/userModel");

async function run() {
  await mongoose.connect("mongodb://localhost:27017/jobpilot-test");

  const user = await User.create({
    email: "test-cast@test.com",
    fullName: "Test",
    phone: "123",
    location: "NY",
    currentJobTitle: "Dev",
    currentCompany: "Inc",
    currentLPA: 10,
    yearsOfExperience: 2,
    targetJobTitle: "Dev",
    expectedLPA: 12,
    preferredLocations: ["NY"],
    jobType: "full-time",
    skills: ["JS"],
  });

  try {
    await User.findByIdAndUpdate(
      user._id,
      { $set: { experienceEntries: [{ company: "A", startMonth: "" }] } },
      { new: true }
    );
    console.log("Success");
  } catch (err) {
    console.error("Error:", err.message);
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

run();
