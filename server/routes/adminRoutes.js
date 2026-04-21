const express = require("express");
const router = express.Router();

const { authenticate, requireAdmin } = require("../middleware/authMiddleware");
const {
  getOverview,
  getUsers,
  getUserById,
  getJobs,
  getJobById,
  softDeleteJob,
  softDeleteJobsBulk,
  getApplications,
  getApplicationFailures,
} = require("../controllers/adminController");

router.use(authenticate);
router.use(requireAdmin);

router.get("/ping", (req, res) => {
  res.status(200).json({ success: true });
});

router.get("/overview", getOverview);
router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.get("/jobs", getJobs);
router.get("/jobs/:id", getJobById);
router.delete("/jobs/:id", softDeleteJob);
router.post("/jobs/bulk-delete", softDeleteJobsBulk);
router.get("/applications", getApplications);
router.get("/applications/failures", getApplicationFailures);

module.exports = router;

