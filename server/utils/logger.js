/**
 * Centralized logging utility for consistent log formatting
 */
const logger = {
  info: (message, data = {}) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [INFO] ${message}`,
      Object.keys(data).length > 0 ? data : ""
    );
  },

  error: (message, error = null, data = {}) => {
    const timestamp = new Date().toISOString();
    const errorDetails = error
      ? {
          message: error.message,
          stack: error.stack,
          ...data,
        }
      : data;
    console.error(`[${timestamp}] [ERROR] ${message}`, errorDetails);
  },

  warn: (message, data = {}) => {
    const timestamp = new Date().toISOString();
    console.warn(
      `[${timestamp}] [WARN] ${message}`,
      Object.keys(data).length > 0 ? data : ""
    );
  },

  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === "development") {
      const timestamp = new Date().toISOString();
      console.log(
        `[${timestamp}] [DEBUG] ${message}`,
        Object.keys(data).length > 0 ? data : ""
      );
    }
  },
};

module.exports = logger;
