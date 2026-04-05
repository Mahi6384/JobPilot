const User = require("../models/userModel");
const Job = require("../models/jobModel");
const ScrapeQuery = require("../models/scrapeQueryModel");
const { runOnDemandScrape } = require("../services/onDemandScraper");
const { extractStructuredResume } = require("../utils/resumeParser");
const logger = require("../utils/logger");
const pdf = require("pdf-parse");

// ── Validation Helpers ───────────────────────────────────────────────────────

const STEP_RULES = {
  1: {
    required: ["fullName", "phone", "location"],
    labels: {
      fullName: "Full name",
      phone: "Phone",
      location: "Location",
    },
  },
  2: {
    required: ["currentJobTitle", "currentCompany"],
    requiredNumeric: ["currentLPA", "yearsOfExperience"],
    labels: {
      currentJobTitle: "Current job title",
      currentCompany: "Current company",
      currentLPA: "Current LPA",
      yearsOfExperience: "Years of experience",
    },
  },
  3: {
    required: ["targetJobTitle", "jobType"],
    requiredNumeric: ["expectedLPA"],
    requiredArray: ["preferredLocations"],
    labels: {
      targetJobTitle: "Target job title",
      expectedLPA: "Expected LPA",
      preferredLocations: "At least one preferred location",
      jobType: "Job type",
    },
  },
  4: {
    requiredArray: ["skills"],
    labels: {
      skills: "At least one skill",
    },
  },
};

/**
 * Validates data against step rules. Returns array of error messages (empty = valid).
 */
function validateStepData(data, stepNumber) {
  const rules = STEP_RULES[stepNumber];
  if (!rules) return [`Invalid step number: ${stepNumber}`];

  const errors = [];

  (rules.required || []).forEach((field) => {
    if (!data[field]?.toString().trim()) {
      errors.push(`${rules.labels[field] || field} is required`);
    }
  });

  (rules.requiredNumeric || []).forEach((field) => {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`${rules.labels[field] || field} is required`);
    }
  });

  (rules.requiredArray || []).forEach((field) => {
    if (!data[field] || data[field].length === 0) {
      errors.push(`${rules.labels[field] || field} is required`);
    }
  });

  return errors;
}

/**
 * Validates a full profile update (all fields at once).
 */
function validateProfileData(data) {
  const errors = [];
  for (let step = 1; step <= 4; step++) {
    errors.push(...validateStepData(data, step));
  }
  return errors;
}

// ── Step field mapping ───────────────────────────────────────────────────────

const STEP_FIELDS = {
  1: ["fullName", "phone", "location"],
  2: ["currentJobTitle", "currentCompany", "currentLPA", "yearsOfExperience"],
  3: ["targetJobTitle", "expectedLPA", "preferredLocations", "jobType"],
  4: ["skills", "resumeUrl", "linkedinUrl"],
};

function pickStepFields(data, step) {
  const fields = {};
  STEP_FIELDS[step].forEach((key) => {
    if (data[key] !== undefined) fields[key] = data[key];
  });
  if (step === 4) {
    fields.onboardingStatus = "completed";
  }
  return fields;
}

// ── Controllers ──────────────────────────────────────────────────────────────

const getOnboardingStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const currentStep = computeCurrentStep(user);

    res.status(200).json({
      onboardingStatus: user.onboardingStatus,
      currentStep,
      profile: {
        fullName: user.fullName,
        phone: user.phone,
        location: user.location,
        currentJobTitle: user.currentJobTitle,
        currentCompany: user.currentCompany,
        currentLPA: user.currentLPA,
        yearsOfExperience: user.yearsOfExperience,
        targetJobTitle: user.targetJobTitle,
        expectedLPA: user.expectedLPA,
        preferredLocations: user.preferredLocations,
        jobType: user.jobType,
        skills: user.skills,
        resumeUrl: user.resumeUrl,
        linkedinUrl: user.linkedinUrl,
      },
    });
  } catch (error) {
    logger.error("Get onboarding status error", error);
    res.status(500).json({ success: false, message: "Failed to get onboarding status" });
  }
};

const saveStep = async (req, res) => {
  try {
    const step = parseInt(req.params.stepNumber);
    if (step < 1 || step > 4) {
      return res.status(400).json({ success: false, message: "Invalid step number" });
    }

    const errors = validateStepData(req.body, step);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(", ") });
    }

    const updateFields = pickStepFields(req.body, step);

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateFields },
      { new: true }
    ).select("-passwordHash");

    logger.info(`User ${req.userId} completed onboarding step ${step}`);

    // On final step, trigger scraping if needed
    if (step === 4 && user.targetJobTitle) {
      await triggerScrapeIfNeeded(user);
    }

    res.status(200).json({
      success: true,
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
    res.status(500).json({ success: false, message: "Failed to save step data" });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, profile: user });
  } catch (error) {
    logger.error("Get profile error", error);
    res.status(500).json({ success: false, message: "Failed to get profile" });
  }
};

const getResumeData = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        name: user.fullName || null,
        email: user.email || null,
        phone: user.phone || null,
        skills: user.skills || [],
        experience: {
          years: user.yearsOfExperience || 0,
          currentTitle: user.currentJobTitle || null,
          currentCompany: user.currentCompany || null,
        },
        education: [],
        expectedSalary: user.expectedLPA ? String(user.expectedLPA) : null,
        currentCtc: user.currentLPA ? String(user.currentLPA) : null,
        location: user.location || null,
        linkedinUrl: user.linkedinUrl || null,
        resumeUrl: user.resumeUrl || null,
      },
    });
  } catch (error) {
    logger.error("Get resume data error", error);
    res.status(500).json({ success: false, message: "Failed to get resume data" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const errors = validateProfileData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    const updateFields = {
      fullName: req.body.fullName,
      phone: req.body.phone,
      location: req.body.location,
      currentJobTitle: req.body.currentJobTitle,
      currentCompany: req.body.currentCompany,
      currentLPA: req.body.currentLPA,
      yearsOfExperience: req.body.yearsOfExperience,
      targetJobTitle: req.body.targetJobTitle,
      expectedLPA: req.body.expectedLPA,
      preferredLocations: req.body.preferredLocations,
      jobType: req.body.jobType,
      skills: req.body.skills,
      resumeUrl: req.body.resumeUrl || undefined,
      linkedinUrl: req.body.linkedinUrl || undefined,
    };

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateFields },
      { new: true }
    ).select("-passwordHash");

    logger.info(`User ${req.userId} updated their profile`);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: user,
    });
  } catch (error) {
    logger.error("Update profile error", error);
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

const parseResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No resume file uploaded" });
    }

    const data = await pdf(req.file.buffer);
    const structured = extractStructuredResume(data.text);

    res.status(200).json({
      success: true,
      skills: structured.skills,
      yearsOfExperience: String(structured.experience.years),
      structured,
    });
  } catch (error) {
    logger.error("Resume parsing error", error);
    res.status(500).json({
      success: false,
      message: "Failed to parse resume",
      error: error.message,
    });
  }
};

// ── Internal Helpers ─────────────────────────────────────────────────────────

function computeCurrentStep(user) {
  let step = 1;
  if (user.fullName && user.phone && user.location) step = 2;
  if (user.currentJobTitle && user.currentCompany &&
      user.currentLPA !== undefined && user.yearsOfExperience !== undefined) step = 3;
  if (user.targetJobTitle && user.expectedLPA !== undefined &&
      user.preferredLocations?.length > 0 && user.jobType) step = 4;
  if (user.skills?.length > 0) step = 5;
  return step;
}

async function triggerScrapeIfNeeded(user) {
  await ScrapeQuery.findOneAndUpdate(
    { query: user.targetJobTitle.toLowerCase().trim() },
    {
      query: user.targetJobTitle.toLowerCase().trim(),
      addedBy: user._id,
      source: "onboarding",
      lastScrapedAt: new Date(0),
    },
    { upsert: true, new: true }
  );

  const escapedTitle = user.targetJobTitle.replace(
    /[.*+?^${}()|[\]\\]/g, "\\$&"
  );
  const matchingJobCount = await Job.countDocuments({
    title: { $regex: escapedTitle, $options: "i" },
  });

  if (matchingJobCount < 50) {
    logger.info(
      `Few matching jobs (${matchingJobCount}) for "${user.targetJobTitle}", triggering on-demand scrape`
    );
    runOnDemandScrape(user._id, user.targetJobTitle).catch((err) =>
      logger.error("On-demand scrape background error", err)
    );
  } else {
    logger.info(
      `Sufficient jobs (${matchingJobCount}) for "${user.targetJobTitle}", skipping scrape`
    );
    await User.findByIdAndUpdate(user._id, { jobSearchStatus: "ready" });
  }
}

module.exports = {
  getOnboardingStatus,
  saveStep,
  getProfile,
  getResumeData,
  updateProfile,
  parseResume,
};
