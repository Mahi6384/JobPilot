const express = require("express");
const app = express();
const PORT = 5000;
app.use(express.json());
app.get("/hello", (req, res) => res.send("jkbfsjfh"));
app.listen(PORT, () => {
  console.log(`Server is running at: http://localhost:${PORT}`);
});
