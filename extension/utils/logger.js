const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVELS.info;

function formatEntry(level, context, args) {
  const ts = new Date().toISOString();
  const prefix = context.jobId
    ? `[JobPilot][${context.platform || "?"}][${context.jobId}]`
    : `[JobPilot]`;
  return { ts, level, prefix, args };
}

function emit(level, context, args) {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return;
  const { prefix } = formatEntry(level, context, args);
  const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[method](prefix, ...args);
}

const logger = {
  _context: {},

  withContext(ctx) {
    const child = Object.create(logger);
    child._context = { ...this._context, ...ctx };
    return child;
  },

  debug(...args) { emit("debug", this._context, args); },
  info(...args) { emit("info", this._context, args); },
  warn(...args) { emit("warn", this._context, args); },
  error(...args) { emit("error", this._context, args); },

  step(stepName, result, detail) {
    const ctx = this._context;
    const entry = {
      jobId: ctx.jobId || null,
      platform: ctx.platform || null,
      step: stepName,
      result,
      detail: detail || null,
      ts: new Date().toISOString(),
    };
    console.log(`[JobPilot][STEP]`, JSON.stringify(entry));
    return entry;
  },
};
