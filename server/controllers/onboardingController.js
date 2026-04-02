const User = require("../models/userModel");
const Job = require("../models/jobModel");
const ScrapeQuery = require("../models/scrapeQueryModel");
const { runOnDemandScrape } = require("../services/onDemandScraper");
const logger = require("../utils/logger");
const pdf = require("pdf-parse");

const COMMON_SKILLS = [
  "javascript", "python", "java", "c++", "c#", "ruby", "php", "typescript", "swift", "kotlin", "go", "rust",
  "html", "css", "react", "angular", "vue", "node.js", "express", "django", "flask", "spring", "asp.net",
  "sql", "mysql", "postgresql", "mongodb", "redis", "elasticsearch", "aws", "azure", "gcp", "docker", 
  "kubernetes", "git", "linux", "unix", "agile", "scrum", "machine learning", "data science", "nlp"
];

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

    // After final step: trigger on-demand scraping if needed
    if (step === 4 && user.targetJobTitle) {
      // ALWAYS save query for future scheduled scrapes
      await ScrapeQuery.findOneAndUpdate(
        { query: user.targetJobTitle.toLowerCase().trim() },
        {
          query: user.targetJobTitle.toLowerCase().trim(),
          addedBy: user._id,
          source: "onboarding",
          lastScrapedAt: new Date(0), // Set to epoch so the daily scraper prioritizes it immediately
        },
        { upsert: true, new: true }
      );

      // Escape regex chars to prevent crashes with titles like "C++ Developer"
      const escapedTitle = user.targetJobTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      const matchingJobCount = await Job.countDocuments({
        title: { $regex: escapedTitle, $options: "i" },
      });

      if (matchingJobCount < 50) {
        logger.info(`Few matching jobs (${matchingJobCount} < 50) for "${user.targetJobTitle}", triggering on-demand scrape`);
        // Fire-and-forget: don't await, let it run in background
        runOnDemandScrape(user._id, user.targetJobTitle).catch((err) =>
          logger.error("On-demand scrape background error", err)
        );
      } else {
        // Enough jobs exist, mark as ready immediately
        logger.info(`Sufficient jobs (${matchingJobCount} >= 20) already exist for "${user.targetJobTitle}", skipping mini-scraper.`);
        await User.findByIdAndUpdate(user._id, { jobSearchStatus: "ready" });
      }
    }

    res.status(200).json({
      message: `Step ${step} saved successfully`,
      user: {
        id: user._id,
        email: user.email,
        onboardingStatus: user.onboardingStatus,
        jobSearchStatus: user.jobSearchStatus,
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

// Parse Resume
const parseResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No resume file uploaded" });
    }
    
    // Parse the PDF
    const data = await pdf(req.file.buffer);
    const text = data.text.toLowerCase();
    
    // Non-AI Extractor
    const extractedSkills = new Set();
    COMMON_SKILLS.forEach(skill => {
      // Escape specical chars
      const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // If skill ends with a word character (like a, b, 1), we can use \b. 
      // If it ends with a non-word char (like + or #), \b will fail if followed by space.
      // E.g., 'c++' -> ends with '+'. We should use (?!\w) or (?=[^a-zA-Z0-9_]|$) instead.
      const startBoundary = /^\w/.test(skill) ? '\\b' : '';
      const endBoundary = /\w$/.test(skill) ? '\\b' : '(?![a-zA-Z0-9_])';

      const regex = new RegExp(`${startBoundary}${escapedSkill}${endBoundary}`, "i");
      if (regex.test(text)) {
        // Find proper casing
        const originalIndex = COMMON_SKILLS.indexOf(skill);
        extractedSkills.add(COMMON_SKILLS[originalIndex]); // Using original array order as our list. We can improve casing later.
      }
    });
    
    // Better casing mapping (simplistic)
    const formattedSkills = Array.from(extractedSkills).map(s => {
      if (s === "javascript") return "JavaScript";
      if (s === "typescript") return "TypeScript";
      if (s === "java") return "Java";
      if (s === "python") return "Python";
      if (s === "react") return "React";
      if (s === "node.js") return "Node.js";
      if (s === "html") return "HTML";
      if (s === "css") return "CSS";
      if (s === "sql") return "SQL";
      if (s === "aws") return "AWS";
      if (s === "docker") return "Docker";
      return s.charAt(0).toUpperCase() + s.slice(1);
    });

    res.status(200).json({
      success: true,
      skills: formattedSkills,
      // Minimal simulated parsing
      yearsOfExperience: text.match(/\b([1-9][0-9]?)\s*(?:\+)?\s*years/i)?.[1] || "0",
    });

  } catch (error) {
    logger.error("Resume parsing error", error);
    res.status(500).json({ message: "Failed to parse resume", error: error.message });
  }
};

module.exports = {
  getOnboardingStatus,
  saveStep,
  getProfile,
  updateProfile,
  parseResume,
};
