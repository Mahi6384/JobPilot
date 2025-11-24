import React, { useEffect, useState } from "react";
import axios from "axios";

function ShowJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState({});
  const [applyingAll, setApplyingAll] = useState(false);

  async function getJob() {
    try {
      const response = await axios.get("http://localhost:5000/api/jobs");
      setJobs(response.data.data);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      if (error.response) {
        if (error.response.status === 401) {
          setError("Please login to view jobs");
        } else if (error.response.status === 404) {
          setError("No jobs found. Please scrape jobs first.");
        } else {
          setError(
            `Error: ${error.response.data.message || error.response.status}`
          );
        }
      } else if (error.request) {
        setError(
          "Cannot connect to server. Make sure the server is running on port 5000."
        );
      } else {
        setError(`Error: ${error.message}`);
      }
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    getJob();
    // Refresh jobs every 5 seconds to catch updates after scraping
    const interval = setInterval(() => {
      getJob();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleApply = async (jobId, jobUrl) => {
    try {
      if (!jobUrl) {
        alert(
          "Job URL not available. Please scrape jobs again to get updated job links."
        );
        return;
      }

      setApplying((prev) => ({ ...prev, [jobId]: true }));
      const token = localStorage.getItem("token");

      const response = await axios.post(
        `http://localhost:5000/api/jobs/${jobId}/apply`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert("Application submitted successfully!");
      // Refresh jobs to update applied status
      getJob();
    } catch (error) {
      console.error("Error applying to job:", error);
      if (error.response) {
        alert(`Error: ${error.response.data.message || "Failed to apply"}`);
      } else {
        alert("Cannot connect to server.");
      }
    } finally {
      setApplying((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const handleApplyAll = async () => {
    try {
      const unappliedJobs = jobs.filter((job) => !job.applied);
      if (unappliedJobs.length === 0) {
        alert("No unapplied jobs available.");
        return;
      }

      const confirmApply = window.confirm(
        `Are you sure you want to apply to all ${unappliedJobs.length} jobs?`
      );
      if (!confirmApply) {
        return;
      }

      setApplyingAll(true);
      const token = localStorage.getItem("token");

      const response = await axios.post(
        "http://localhost:5000/api/jobs/auto-apply",
        { limit: unappliedJobs.length },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert(
        `Auto-apply completed! Applied to ${response.data.applied} out of ${response.data.total} jobs.`
      );
      // Refresh jobs to update applied status
      getJob();
    } catch (error) {
      console.error("Error applying to all jobs:", error);
      if (error.response) {
        alert(
          `Error: ${error.response.data.message || "Failed to apply to all jobs"}`
        );
      } else {
        alert("Cannot connect to server.");
      }
    } finally {
      setApplyingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-white text-xl">Loading jobs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px]">
        <p className="text-red-400 text-xl mb-4">{error}</p>
        <button
          onClick={getJob}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-white text-xl">
          No jobs available. Please scrape jobs first.
        </p>
      </div>
    );
  }

  return (
    <div className="pl-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-12 font-montserrat font-medium">
        {jobs.map((jobCard, index) => (
          <div
            key={jobCard._id || index}
            className="flex flex-col items-center"
          >
            <div className="bg-white/80 w-full max-w-sm text-black p-8 rounded-t-md">
              <p className="truncate">Name : {jobCard.title}</p>
              <p className="truncate">Company : {jobCard.companyName}</p>
              <p className="truncate">Location : {jobCard.location}</p>
              <p className="truncate">Experience : {jobCard.experience}</p>
              {jobCard.applied && (
                <p className="text-green-600 font-semibold mt-2">✓ Applied</p>
              )}
            </div>
            <button
              onClick={() => handleApply(jobCard._id, jobCard.jobUrl)}
              disabled={applying[jobCard._id] || jobCard.applied || applyingAll}
              className="w-full max-w-sm bg-white/60 hover:bg-white/80 disabled:bg-gray-400 text-gray-950 text-lg py-3 rounded-b-md transition-colors"
            >
              {applying[jobCard._id]
                ? "Applying..."
                : jobCard.applied
                  ? "Already Applied"
                  : "Apply"}
            </button>
          </div>
        ))}
      </div>
      {jobs.length > 0 && (
        <div className="flex justify-center mt-8 mb-4">
          <button
            onClick={handleApplyAll}
            disabled={applyingAll || jobs.every((job) => job.applied)}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-colors"
          >
            {applyingAll
              ? "Applying to all jobs..."
              : jobs.every((job) => job.applied)
                ? "All Jobs Applied"
                : `Apply to All Jobs (${jobs.filter((job) => !job.applied).length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}

export default ShowJobs;
