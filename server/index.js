const express = require("express");
const app = express();
require("dotenv").config();
const PORT = process.env.PORT;
app.use(express.json());
app.get("/hello", (req, res) => res.send("jkbfsjfh"));
app.listen(PORT, () => {
  console.log(`Server is running at: http://localhost:${PORT}`);
});
