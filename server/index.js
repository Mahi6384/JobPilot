const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
 userSchema
const PORT = process.env.PORT || 5000;


require("dotenv").config();
const PORT = process.env.PORT;
main
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });


app.get("/hello", (req, res) => res.send("Hello from Khushi’s server!"));


app.listen(PORT, () => {
  console.log(`Server is running at: http://localhost:${PORT}`);
});
