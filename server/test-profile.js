const mongoose = require("mongoose");
const User = require("./models/userModel");
const { updateProfile } = require("./controllers/onboardingController");

async function run() {
  await mongoose.connect("mongodb://localhost:27017/jobpilot-test");

  const user = await User.create({
    email: "test@test.com",
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

  const req = {
    userId: user._id,
    body: {
      ...user.toObject(),
      experienceEntries: [{ company: "New Co", title: "Dev", startMonth: "", isCurrent: true }],
      educationEntries: [{ school: "MIT", degree: "BS" }],
      socials: { githubUrl: "github.com/test" },
      eeo: { gender: "Male" }
    }
  };

  const res = {
    status: (code) => {
      console.log("Status:", code);
      return res;
    },
    json: (data) => {
      console.log("Response JSON", JSON.stringify(data));
    }
  };

  await updateProfile(req, res);
  
  const updated = await User.findById(user._id);
  console.log("Updated experienceEntries:", updated.experienceEntries[0]);
  console.log("Updated socials:", updated.socials);
  console.log("Updated eeo:", updated.eeo);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

run().catch(console.error);
