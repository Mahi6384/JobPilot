const express = require("express");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const onboardingRoutes = require("./routes/onboardingRoutes");
const dotenv = require("dotenv");
const cors = require("cors");
const { validateEnv } = require("./utils/envValidator");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const jobRoutes = require("./routes/jobRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const aiRoutes = require("./routes/aiRoutes");
dotenv.config();

try {
  validateEnv();
} catch (error) {
  logger.error("Environment validation failed", error);
  process.exit(1);
}

const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // allow server-to-server / curl / health checks

  // MV3 extension popup / service worker fetch uses Origin: chrome-extension://<id>
  if (/^chrome-extension:\/\//i.test(origin)) return true;

  // Allow any Vercel preview/prod subdomain (tight enough for this app)
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;

  // Explicit known origins (local + optional env vars)
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.EXTENSION_ORIGIN,
    "https://jobpilot-wheat.vercel.app",
    "http://localhost:5173",
    ...parseCsv(process.env.ALLOWED_ORIGINS),
  ].filter(Boolean);

  return allowedOrigins.includes(origin);
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

// Preflight must use the same origin rules as app.use(cors(...))
app.options("*", cors(corsOptions));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// MongoDB connection with retry logic
const connectDB = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    logger.info("MongoDB connected successfully!");
  } catch (error) {
    logger.error("MongoDB connection failed", error);
    setTimeout(connectDB, 5000);
  }
};

// Handle MongoDB connection events
mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on("error", (error) => {
  logger.error("MongoDB connection error", error);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server is running at: http://localhost:${PORT}`);
  connectDB();
});
