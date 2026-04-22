const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const User = require("../models/userModel");
const Job = require("../models/jobModel");
const ScrapeQuery = require("../models/scrapeQueryModel");
const { runOnDemandScrape } = require("../services/onDemandScraper");
const { extractStructuredResume } = require("../utils/resumeParser");
const logger = require("../utils/logger");
const pdf = require("pdf-parse");

const RESUME_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "resumes");

async function ensureResumeUploadDir() {
  await fs.mkdir(RESUME_UPLOAD_DIR, { recursive: true });
}

async function saveUserResumePdf(userId, buffer) {
  await ensureResumeUploadDir();
  const safeId = String(userId);
  const fp = path.join(RESUME_UPLOAD_DIR, `${safeId}.pdf`);
  await fs.writeFile(fp, buffer);
}

function getUserResumePdfPath(userId) {
  return path.join(RESUME_UPLOAD_DIR, `${String(userId)}.pdf`);
}

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
  // Skills are validated on the client for "Continue"; optional here so Skip can
  // still persist step 4 and set onboardingStatus to completed.
  4: {
    labels: {},
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
  // Full profile save still requires skills; per-step save allows empty (e.g. Skip on onboarding).
  if (!data.skills?.length) {
    errors.push("At least one skill is required");
  }
  return errors;
}

/** Empty strings from form inputs must not be written to Number fields (Mongoose cast error). */
function normalizeOptionalNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeExperienceEntries(entries) {
  if (!Array.isArray(entries)) return entries;
  return entries.map((e) => {
    if (!e || typeof e !== "object") return e;
    return {
      ...e,
      startMonth: normalizeOptionalNumber(e.startMonth),
      startYear: normalizeOptionalNumber(e.startYear),
      endMonth: normalizeOptionalNumber(e.endMonth),
      endYear: normalizeOptionalNumber(e.endYear),
      isCurrent: Boolean(e.isCurrent),
    };
  });
}

function normalizeEducationEntries(entries) {
  if (!Array.isArray(entries)) return entries;
  return entries.map((e) => {
    if (!e || typeof e !== "object") return e;
    return {
      ...e,
      startMonth: normalizeOptionalNumber(e.startMonth),
      startYear: normalizeOptionalNumber(e.startYear),
      endMonth: normalizeOptionalNumber(e.endMonth),
      endYear: normalizeOptionalNumber(e.endYear),
    };
  });
}

// ── Step field mapping ───────────────────────────────────────────────────────

const STEP_FIELDS = {
  1: ["fullName", "phone", "location"],
  2: ["currentJobTitle", "currentCompany", "currentLPA", "yearsOfExperience"],
  3: ["targetJobTitle", "expectedLPA", "preferredLocations", "jobType"],
  4: [
    "skills",
    "resumeUrl",
    "linkedinUrl",
    "socials",
    "experienceEntries",
    "educationEntries",
    "currentJobTitle",
    "currentCompany",
  ],
  5: ["address", "socials"],
  6: ["workEligibility"],
  7: ["experienceEntries"],
  8: ["educationEntries"],
  9: ["eeo"],
};

function pickStepFields(data, step) {
  const fields = {};
  STEP_FIELDS[step].forEach((key) => {
    if (data[key] !== undefined) fields[key] = data[key];
  });
  if (step === 9) {
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
        socials: user.socials,
        experienceEntries: user.experienceEntries,
        educationEntries: user.educationEntries,
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
    if (step < 1 || step > 9) {
      return res.status(400).json({ success: false, message: "Invalid step number" });
    }

    const errors = validateStepData(req.body, step);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(", ") });
    }

    const updateFields = pickStepFields(req.body, step);

    if (step === 7 && updateFields.experienceEntries) {
      updateFields.experienceEntries = normalizeExperienceEntries(updateFields.experienceEntries);
    }
    if (step === 8 && updateFields.educationEntries) {
      updateFields.educationEntries = normalizeEducationEntries(updateFields.educationEntries);
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateFields },
      { new: true }
    ).select("-passwordHash");

    logger.info(`User ${req.userId} completed onboarding step ${step}`);

    // On final step, trigger scraping if needed
    if (step === 9 && user.targetJobTitle) {
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

    const profile = buildCanonicalAutofillProfile(user);
    const missingFields = computeMissingFields(profile);

    res.status(200).json({
      success: true,
      data: {
        ...profile,
        missingFields,
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

    const experienceEntries = normalizeExperienceEntries(req.body.experienceEntries);
    const educationEntries = normalizeEducationEntries(req.body.educationEntries);

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
      // Extended ATS profile
      socials: req.body.socials || undefined,
      address: req.body.address || undefined,
      workEligibility: req.body.workEligibility || undefined,
      experienceEntries: experienceEntries ?? undefined,
      educationEntries: educationEntries ?? undefined,
      eeo: req.body.eeo || undefined,
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
    try {
      const expCount = structured?.experienceEntries?.length || 0;
      const eduCount = structured?.educationEntries?.length || 0;
      logger.info(
        `Resume parsed for user ${req.userId}: skills=${structured?.skills?.length || 0}, expEntries=${expCount}, eduEntries=${eduCount}`
      );
    } catch {
      // ignore logging failures
    }

    try {
      await saveUserResumePdf(req.userId, req.file.buffer);
      const user = await User.findById(req.userId).select(
        "skills yearsOfExperience linkedinUrl socials experienceEntries educationEntries resumeFileStored currentJobTitle currentCompany"
      );

      const patch = { resumeFileStored: true };

      const isBlankObject = (obj) => {
        if (!obj || typeof obj !== "object") return true;
        return Object.values(obj).every((v) => {
          if (v === null || v === undefined) return true;
          if (typeof v === "string") return v.trim() === "";
          if (typeof v === "number") return Number.isNaN(v);
          if (typeof v === "boolean") return v === false;
          return false;
        });
      };

      const isBlankEntriesArray = (arr) =>
        Array.isArray(arr) && arr.length > 0 && arr.every((e) => isBlankObject(e));

      const isMissingOrBlankArray = (arr) => !arr || arr.length === 0 || isBlankEntriesArray(arr);

      // Hybrid: only fill missing/empty
      if ((!user?.skills || user.skills.length === 0) && structured?.skills?.length) {
        patch.skills = structured.skills;
      }
      if (
        (user?.yearsOfExperience == null || user.yearsOfExperience === 0) &&
        structured?.experience?.years != null
      ) {
        patch.yearsOfExperience = structured.experience.years;
      }
      if (!user?.linkedinUrl && structured?.socials?.linkedinUrl) {
        patch.linkedinUrl = structured.socials.linkedinUrl;
      }
      if (!user?.socials?.githubUrl && structured?.socials?.githubUrl) {
        patch["socials.githubUrl"] = structured.socials.githubUrl;
      }
      if (!user?.socials?.portfolioUrl && structured?.socials?.portfolioUrl) {
        patch["socials.portfolioUrl"] = structured.socials.portfolioUrl;
      }
      if (!user?.socials?.twitterUrl && structured?.socials?.twitterUrl) {
        patch["socials.twitterUrl"] = structured.socials.twitterUrl;
      }

      if (
        isMissingOrBlankArray(user?.experienceEntries) &&
        structured?.experienceEntries?.length
      ) {
        patch.experienceEntries = structured.experienceEntries;
      }
      if (
        isMissingOrBlankArray(user?.educationEntries) &&
        structured?.educationEntries?.length
      ) {
        patch.educationEntries = structured.educationEntries;
      }

      const primaryExp =
        structured?.experienceEntries?.find((e) => e && e.isCurrent) ||
        structured?.experienceEntries?.[0];
      if (
        primaryExp?.title &&
        (!user?.currentJobTitle || !String(user.currentJobTitle).trim())
      ) {
        patch.currentJobTitle = primaryExp.title;
      }
      if (
        primaryExp?.company &&
        (!user?.currentCompany || !String(user.currentCompany).trim())
      ) {
        patch.currentCompany = primaryExp.company;
      }

      await User.findByIdAndUpdate(req.userId, { $set: patch });
      logger.info(`Resume PDF stored for user ${req.userId}`);
    } catch (storeErr) {
      logger.error("Failed to persist resume PDF", storeErr);
    }

    res.status(200).json({
      success: true,
      skills: structured.skills,
      yearsOfExperience: String(structured.experience.years),
      structured,
      experienceEntries: structured.experienceEntries || [],
      educationEntries: structured.educationEntries || [],
      socials: structured.socials || null,
      hasResumeFile: true,
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

// ── Canonical ATS Autofill Profile helpers ────────────────────────────────────

function buildCanonicalAutofillProfile(user) {
  const fullName = user.fullName || null;
  const email = user.email || null;
  const phone = user.phone || null;

  const nameParts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const firstName = nameParts[0] || null;
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null;

  const entries = Array.isArray(user.experienceEntries) ? user.experienceEntries : [];
  const derivedFromEntries =
    entries.find((e) => e && e.isCurrent) || entries[0] || null;
  const resolvedCurrentTitle =
    (user.currentJobTitle && String(user.currentJobTitle).trim()) ||
    (derivedFromEntries?.title && String(derivedFromEntries.title).trim()) ||
    null;
  const resolvedCurrentCompany =
    (user.currentCompany && String(user.currentCompany).trim()) ||
    (derivedFromEntries?.company && String(derivedFromEntries.company).trim()) ||
    null;

  const profile = {
    // Identity/contact
    name: fullName,
    firstName,
    lastName,
    email,
    phone,
    phoneExtension: null,

    // Address (use explicit address fields; fall back to legacy `location` for city-like value)
    location: user.location || null,
    address: {
      line1: user.address?.line1 || null,
      line2: user.address?.line2 || null,
      city: user.address?.city || user.location || null,
      region: user.address?.region || null,
      country: user.address?.country || null,
      postalCode: user.address?.postalCode || null,
    },

    // Socials
    linkedinUrl: user.linkedinUrl || null,
    socials: {
      githubUrl: user.socials?.githubUrl || null,
      portfolioUrl: user.socials?.portfolioUrl || null,
      twitterUrl: user.socials?.twitterUrl || null,
    },

    // Work eligibility
    workEligibility: {
      authorizedToWork: user.workEligibility?.authorizedToWork || null,
      needsSponsorship: user.workEligibility?.needsSponsorship || null,
      willingToRelocate: user.workEligibility?.willingToRelocate || null,
    },

    // Compensation/availability
    expectedSalary: user.expectedLPA != null ? String(user.expectedLPA) : null,
    currentCtc: user.currentLPA != null ? String(user.currentLPA) : null,
    noticePeriod: null,

    // Skills / experience / education
    skills: user.skills || [],
    experience: {
      years: user.yearsOfExperience || 0,
      currentTitle: resolvedCurrentTitle,
      currentCompany: resolvedCurrentCompany,
      entries: user.experienceEntries || [],
    },
    education: user.educationEntries || [],

    // EEO
    eeo: {
      gender: user.eeo?.gender || null,
      raceEthnicity: user.eeo?.raceEthnicity || null,
      veteranStatus: user.eeo?.veteranStatus || null,
      disabilityStatus: user.eeo?.disabilityStatus || null,
    },

    // Docs
    resumeUrl: user.resumeUrl || null,
    hasResumeFile: Boolean(user.resumeFileStored),
  };

  return profile;
}

function computeMissingFields(profile) {
  const missing = [];

  const req = (path, label) => {
    const v = getByPath(profile, path);
    const empty =
      v == null ||
      (typeof v === "string" && !v.trim()) ||
      (Array.isArray(v) && v.length === 0);
    if (empty) missing.push({ path, label });
  };

  // Core
  req("firstName", "First name");
  req("lastName", "Last name");
  req("email", "Email");
  req("phone", "Phone");

  // Address (ATS commonly requires at least city/country/zip; start with basics)
  req("address.city", "City");
  req("address.country", "Country");
  req("address.postalCode", "Postal/Zip code");

  // Socials
  req("linkedinUrl", "LinkedIn URL");
  req("socials.githubUrl", "GitHub URL");
  req("socials.portfolioUrl", "Portfolio/Website URL");

  // Resume
  const hasResume = Boolean(profile.hasResumeFile);
  if (!hasResume) missing.push({ path: "hasResumeFile", label: "Resume file" });

  // Experience & skills
  req("skills", "Skills");
  // At least one experience entry helps Workday; keep it optional but recommended.
  if (!profile.experience?.entries?.length) {
    missing.push({ path: "experience.entries", label: "Work experience entries" });
  }
  if (!profile.education?.length) {
    missing.push({ path: "education", label: "Education entries" });
  }

  return missing;
}

function getByPath(obj, path) {
  const parts = String(path).split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Authenticated download of the PDF saved during parse-resume (for the extension). */
const downloadResumeFile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("resumeFileStored");
    if (!user?.resumeFileStored) {
      return res.status(404).json({ success: false, message: "No resume file stored" });
    }

    const fp = getUserResumePdfPath(req.userId);
    try {
      await fs.access(fp);
    } catch {
      return res.status(404).json({ success: false, message: "Resume file missing on disk" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="resume.pdf"');
    const stream = fsSync.createReadStream(fp);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Failed to read resume" });
      }
    });
    stream.pipe(res);
  } catch (error) {
    logger.error("Download resume error", error);
    res.status(500).json({ success: false, message: "Failed to download resume" });
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
  downloadResumeFile,
};
