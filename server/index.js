const express = require("express");
const mongoose = require("mongoose");
const jobRoutes = require("./routes/jobRoutes");
const authRoutes = require("./routes/authRoutes");
const userProfileRoutes = require("./routes/userProfileRoutes");
const naukriRoutes = require("./routes/naukriRoutes");
const linkedinRoutes = require("./routes/linkedinRoutes");
const dotenv = require("dotenv");
const cors = require("cors");
const { validateEnv } = require("./utils/envValidator");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const logger = require("./utils/logger");

dotenv.config();

// Validate environment variables
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
app.use(cors());

// Health check endpoint
app.get("/hi", (req, res) => res.send("Hello from Mahi server!"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", userProfileRoutes);
app.use("/api/naukri", naukriRoutes);
app.use("/api/linkedin", linkedinRoutes);
app.use("/api/jobs", jobRoutes);

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

  // Start daily scraper cron job
  if (process.env.NODE_ENV !== "test") {
    require("./jobs/dailyScraper");
    logger.info("Daily scraper cron job started");
  }
});
