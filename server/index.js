const express = require("express");
const mongoose = require("mongoose");
const jobRoutes = require("./routes/jobRoutes");
const dotenv = require("dotenv");
dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });
app.get("/hi", (req, res) => res.send("Hello from Mahi server!"));
app.use("/api/jobs", jobRoutes);

app.listen(PORT, () => {
  console.log("Server is running at: http://localhost:${PORT}");
});
