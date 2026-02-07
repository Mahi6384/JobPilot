/**
 * Environment variable validation
 */

const requiredEnvVars = ["MONGODB_URI", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];

const validateEnv = () => {
  const missing = [];
  const warnings = [];

  // Check required variables
  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  // Check optional but recommended variables
  if (!process.env.PORT) {
    warnings.push("PORT not set, using default: 5000");
  }

  if (!process.env.NODE_ENV) {
    warnings.push("NODE_ENV not set, defaulting to development");
    process.env.NODE_ENV = "development";
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      console.warn(`[ENV WARNING] ${warning}`);
    });
  }

  return true;
};

module.exports = { validateEnv };
