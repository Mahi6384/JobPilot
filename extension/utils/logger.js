// Simple logger with [JobPilot] prefix

const logger = {
  info: (...args) => {}, // Disabled for production
  error: (...args) => console.error("[JobPilot ERROR]", ...args),
  warn: (...args) => console.warn("[JobPilot WARN]", ...args),
};
