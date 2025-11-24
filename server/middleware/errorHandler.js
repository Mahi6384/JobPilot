const logger = require("../utils/logger");

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error("Unhandled error", err, {
    path: req.path,
    method: req.method,
    body: req.body,
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  // Handle specific error types
  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation error",
      errors: isDevelopment ? err.message : "Invalid input data",
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      message: "Invalid ID format",
    });
  }

  if (err.name === "MongoServerError" && err.code === 11000) {
    return res.status(409).json({
      message: "Duplicate entry",
      error: isDevelopment ? err.message : "Resource already exists",
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
    error: isDevelopment ? err.stack : undefined,
  });
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.path} not found`,
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
