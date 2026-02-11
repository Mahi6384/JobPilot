const Job = require("../models/jobModel");
const getMatchedJobs = require("../services/matchingService").getMatchedJobs;
const logger = require("../utils/logger");

// get api/jobs/filters
const getMatchedJobsHandles = async(req, res)=>{
    try{
        const {
            platform, jobtype, location, experienceMin, experienceMax, salaryMin, salaryMax, page = 1, limit = 10
        } = req.query;

        const filters = {};
        if(platform) filters.platform = platform;
        if(jobtype) filters.jobType = jobtype;
        if(location) filters.location = location;
        if(experienceMin) filters.experienceMin = experienceMin;
        if(experienceMax) filters.experienceMax = experienceMax;
        if(salaryMin) filters.salaryMin = salaryMin;
        if(salaryMax) filters.salaryMax = salaryMax;

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
        const totalMatches = await Job.countDocuments();
        
        return res.status(200).json({
            stats: {
                totalMatches,
                appliedToday: 0,  // Placeholder for future
                successRate: 0,   // Placeholder for future
            },
            topJobs: topJobs.jobs,
        });
    } catch (error) {
        logger.error("Error in getDashboardData", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getMatchedJobsHandles,
    getJobFilters,
    getJobsById,
    getDashboardData
}