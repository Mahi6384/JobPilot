const Job = require("../models/jobModel");
const User = require("../models/userModel");
const Application = require("../models/applicationModel");
const getMatchedJobs = require("../services/matchingService").getMatchedJobs;
const logger = require("../utils/logger");

// get api/jobs/filters
const getMatchedJobsHandles = async(req, res)=>{
    try{
        const {
            platform, jobType, jobtype, applyType, location, experienceMin, experienceMax, salaryMin, salaryMax, page = 1, limit = 10
        } = req.query;

        const filters = {};
        // Support both camelCase (jobType) and lowercase (jobtype) from older clients
        const resolvedJobType = jobType || jobtype;

        if (platform) filters.platform = platform.split(",");
        if (resolvedJobType) filters.jobType = resolvedJobType.split(",");
        if (applyType) filters.applyType = applyType.split(",");
        if (location) filters.location = location;
        if (experienceMin) filters.experienceMin = experienceMin;
        if (experienceMax) filters.experienceMax = experienceMax;
        if (salaryMin) filters.salaryMin = salaryMin;
        if (salaryMax) filters.salaryMax = salaryMax;

        const result = await getMatchedJobs(req.userId, filters, Number(page), Number(limit));
        return res.status(200).json(result);

    }
    catch(error){
        logger.error("Error in getMatchedJobsHandles", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const getJobFilters = async(req, res) =>{
    try{
        const[platforms, jobTypes, locations] = await Promise.all([
            Job.distinct("platform").exec(),
            Job.distinct("jobType").exec(),
            Job.distinct("location").exec(),
        ])
        return res.status(200).json({platforms, jobTypes, locations});
    }
    catch(error){
        logger.error("Error in fetching job filters", error);
        return res.status(500).json({ error: "failed to fetch job filters" });
    }
}

const getJobsById = async (req, res) =>{
    try{
        const job = await Job.findById(req.params.id);
        if(!job){
            return res.status(404).json({ error: "Job not found" });
        }
        return res.status(200).json(job);
    }
    catch(error){
        logger.error("Error in fetching job by id", error);
        return res.status(500).json({ error: "failed to fetch job by id" });
    }
}

const getDashboardData = async (req, res) => {
    try {
        const topJobs = await getMatchedJobs(req.userId, {}, 1, 5);
        const totalMatches = await Job.countDocuments({});

        // Compute real stats from Application model
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [appliedToday, totalApplied, totalApplications] = await Promise.all([
            Application.countDocuments({
                userId: req.userId,
                status: "applied",
                appliedAt: { $gte: todayStart },
            }),
            Application.countDocuments({
                userId: req.userId,
                status: "applied",
            }),
            Application.countDocuments({
                userId: req.userId,
            }),
        ]);

        const successRate = totalApplications > 0
            ? Math.round((totalApplied / totalApplications) * 100)
            : 0;

        return res.status(200).json({
            stats: {
                totalMatches,
                appliedToday,
                successRate,
            },
            topJobs: topJobs.jobs,
        });
    } catch (error) {
        logger.error("Error in getDashboardData", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getJobSearchStatus = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("jobSearchStatus");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.status(200).json({ jobSearchStatus: user.jobSearchStatus });
    } catch (error) {
        logger.error("Error in getJobSearchStatus", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getMatchedJobsHandles,
    getJobFilters,
    getJobsById,
    getDashboardData,
    getJobSearchStatus
}