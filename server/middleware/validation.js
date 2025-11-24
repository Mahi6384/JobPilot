const { validateJobData, validateUserData } = require("../utils/validator");
const logger = require("../utils/logger");

/**
 * Middleware to validate job data
 */
const validateJobDataMiddleware = (req, res, next) => {
  const validation = validateJobData(req.body);

  if (!validation.isValid) {
    logger.warn("Job data validation failed", { errors: validation.errors });
    return res.status(400).json({
      message: "Invalid job data",
      errors: validation.errors,
    });
  }

  next();
};

/**
 * Middleware to validate user data for job application
 */
const validateUserDataMiddleware = (req, res, next) => {
  const validation = validateUserData(req.body);

  if (!validation.isValid) {
    logger.warn("User data validation failed", { errors: validation.errors });
    return res.status(400).json({
      message: "Invalid user data",
      errors: validation.errors,
    });
  }

  next();
};

module.exports = {
  validateJobDataMiddleware,
  validateUserDataMiddleware,
};
