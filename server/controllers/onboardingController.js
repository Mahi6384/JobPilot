const User = require("../models/userModel");
const logger = require("../utils/logger");

// Get onboarding status and current step data
const getOnboardingStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Determine current step based on filled data
    let currentStep = 1;
    if (user.fullName && user.phone && user.location) {
      currentStep = 2;
    }
    if (user.currentJobTitle && user.currentCompany && user.currentLPA !== undefined && user.yearsOfExperience !== undefined) {
      currentStep = 3;
    }
    if (user.targetJobTitle && user.expectedLPA !== undefined && user.preferredLocations?.length > 0 && user.jobType) {
      currentStep = 4;
    }
    if (user.skills?.length > 0) {
      currentStep = 5; // Completed
    }

    res.status(200).json({
      onboardingStatus: user.onboardingStatus,
      currentStep,
      profile: {
        // Step 1
        fullName: user.fullName,
        phone: user.phone,
        location: user.location,
        // Step 2
        currentJobTitle: user.currentJobTitle,
        currentCompany: user.currentCompany,
        currentLPA: user.currentLPA,
        yearsOfExperience: user.yearsOfExperience,
        // Step 3
        targetJobTitle: user.targetJobTitle,
        expectedLPA: user.expectedLPA,
        preferredLocations: user.preferredLocations,
        jobType: user.jobType,
        // Step 4
        skills: user.skills,
        resumeUrl: user.resumeUrl,
        linkedinUrl: user.linkedinUrl,
      },
    });
  } catch (error) {
    logger.error("Get onboarding status error", error);
    res.status(500).json({ message: "Failed to get onboarding status" });
  }
};

// Save data for a specific step
const saveStep = async (req, res) => {
  try {
    const { stepNumber } = req.params;
    const stepData = req.body;
    const step = parseInt(stepNumber);

    if (step < 1 || step > 4) {
      return res.status(400).json({ message: "Invalid step number" });
    }

    let updateFields = {};
    let validationErrors = [];

    switch (step) {
      case 1:
        // Basic Info
        if (!stepData.fullName) validationErrors.push("Full name is required");
        if (!stepData.phone) validationErrors.push("Phone is required");
        if (!stepData.location) validationErrors.push("Location is required");

        if (validationErrors.length > 0) {
          return res.status(400).json({ message: validationErrors.join(", ") });
        }

        updateFields = {
          fullName: stepData.fullName,
          phone: stepData.phone,
          location: stepData.location,
        };
        break;

      case 2:
        // Current Position
        if (!stepData.currentJobTitle) validationErrors.push("Current job title is required");
        if (!stepData.currentCompany) validationErrors.push("Current company is required");
        if (stepData.currentLPA === undefined) validationErrors.push("Current LPA is required");
        if (stepData.yearsOfExperience === undefined) validationErrors.push("Years of experience is required");

        if (validationErrors.length > 0) {
          return res.status(400).json({ message: validationErrors.join(", ") });
        }

        updateFields = {
          currentJobTitle: stepData.currentJobTitle,
          currentCompany: stepData.currentCompany,
          currentLPA: stepData.currentLPA,
          yearsOfExperience: stepData.yearsOfExperience,
        };
        break;

      case 3:
        // Job Preferences
        if (!stepData.targetJobTitle) validationErrors.push("Target job title is required");
        if (stepData.expectedLPA === undefined) validationErrors.push("Expected LPA is required");
        if (!stepData.preferredLocations || stepData.preferredLocations.length === 0) {
          validationErrors.push("At least one preferred location is required");
        }
        if (!stepData.jobType) validationErrors.push("Job type is required");

        if (validationErrors.length > 0) {
          return res.status(400).json({ message: validationErrors.join(", ") });
        }

        updateFields = {
          targetJobTitle: stepData.targetJobTitle,
          expectedLPA: stepData.expectedLPA,
          preferredLocations: stepData.preferredLocations,
          jobType: stepData.jobType,
        };
        break;

      case 4:
        // Skills & Resume (skills required, resume and linkedin optional)
        if (!stepData.skills || stepData.skills.length === 0) {
          validationErrors.push("At least one skill is required");
        }

        if (validationErrors.length > 0) {
          return res.status(400).json({ message: validationErrors.join(", ") });
        }

        updateFields = {
          skills: stepData.skills,
          resumeUrl: stepData.resumeUrl || undefined,
          linkedinUrl: stepData.linkedinUrl || undefined,
          onboardingStatus: "completed", // Mark as completed on final step
        };
        break;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateFields },
      { new: true }
    ).select("-passwordHash");

    logger.info(`User ${req.userId} completed onboarding step ${step}`);

    res.status(200).json({
      message: `Step ${step} saved successfully`,
      user: {
        id: user._id,
        email: user.email,
        onboardingStatus: user.onboardingStatus,
      },
    });
  } catch (error) {
    logger.error("Save step error", error);
    res.status(500).json({ message: "Failed to save step data" });
  }
};

// Get full user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ profile: user });
  } catch (error) {
    logger.error("Get profile error", error);
    res.status(500).json({ message: "Failed to get profile" });
  }
};

// Update full profile (for profile edit page)
const updateProfile = async (req, res) => {
  try {
    const profileData = req.body;
    let validationErrors = [];

    // Validate Step 1: Basic Info
    if (!profileData.fullName?.trim()) validationErrors.push("Full name is required");
    if (!profileData.phone?.trim()) validationErrors.push("Phone is required");
    if (!profileData.location?.trim()) validationErrors.push("Location is required");

    // Validate Step 2: Current Position
    if (!profileData.currentJobTitle?.trim()) validationErrors.push("Current job title is required");
    if (!profileData.currentCompany?.trim()) validationErrors.push("Current company is required");
    if (profileData.currentLPA === undefined || profileData.currentLPA === null) {
      validationErrors.push("Current LPA is required");
    }
    if (profileData.yearsOfExperience === undefined || profileData.yearsOfExperience === null) {
      validationErrors.push("Years of experience is required");
    }

    // Validate Step 3: Job Preferences
    if (!profileData.targetJobTitle?.trim()) validationErrors.push("Target job title is required");
    if (profileData.expectedLPA === undefined || profileData.expectedLPA === null) {
      validationErrors.push("Expected LPA is required");
    }
    if (!profileData.preferredLocations || profileData.preferredLocations.length === 0) {
      validationErrors.push("At least one preferred location is required");
    }
    if (!profileData.jobType) validationErrors.push("Job type is required");

    // Validate Step 4: Skills
    if (!profileData.skills || profileData.skills.length === 0) {
      validationErrors.push("At least one skill is required");
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: validationErrors 
      });
    }

    const updateFields = {
      fullName: profileData.fullName,
      phone: profileData.phone,
      location: profileData.location,
      currentJobTitle: profileData.currentJobTitle,
      currentCompany: profileData.currentCompany,
      currentLPA: profileData.currentLPA,
      yearsOfExperience: profileData.yearsOfExperience,
      targetJobTitle: profileData.targetJobTitle,
      expectedLPA: profileData.expectedLPA,
      preferredLocations: profileData.preferredLocations,
      jobType: profileData.jobType,
      skills: profileData.skills,
      resumeUrl: profileData.resumeUrl || undefined,
      linkedinUrl: profileData.linkedinUrl || undefined,
    };

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateFields },
      { new: true }
    ).select("-passwordHash");

    logger.info(`User ${req.userId} updated their profile`);

    res.status(200).json({
      message: "Profile updated successfully",
      profile: user,
    });
  } catch (error) {
    logger.error("Update profile error", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

module.exports = {
  getOnboardingStatus,
  saveStep,
  getProfile,
  updateProfile,
};
