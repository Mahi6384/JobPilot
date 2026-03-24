// Simple logger with [JobPilot] prefix

const logger = {
  info: (...args) => console.log("[JobPilot]", ...args),
  error: (...args) => console.error("[JobPilot ERROR]", ...args),
  warn: (...args) => console.warn("[JobPilot WARN]", ...args),
};
