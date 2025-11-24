import React, { useState, useEffect } from "react";
import axios from "axios";
import ShowJobs from "../components/showJobs";

function Dashboard() {
  const [scraping, setScraping] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState("");
  const [activeTab, setActiveTab] = useState("jobs");
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [loadingApplied, setLoadingApplied] = useState(false);
  const [scrapingLinkedIn, setScrapingLinkedIn] = useState(false);
  const [linkedInScrapeMessage, setLinkedInScrapeMessage] = useState("");
  const [linkedInJobTitle, setLinkedInJobTitle] = useState("");

  useEffect(() => {
    if (activeTab === "applied") {
      fetchAppliedJobs();
    }
  }, [activeTab]);

  const fetchAppliedJobs = async () => {
    setLoadingApplied(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("http://localhost:5000/api/jobs/applied", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppliedJobs(response.data.data || []);
    } catch (error) {
      console.error("Error fetching applied jobs:", error);
    } finally {
      setLoadingApplied(false);
    }
  };

  const handleScrapeJobs = async () => {
    try {
      setScraping(true);
      setScrapeMessage("");
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://localhost:5000/api/jobs/scrape",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setScrapeMessage(`Jobs scraped successfully! Found ${response.data.total} jobs.`);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error scraping jobs:", error);
      if (error.response) {
        setScrapeMessage(`Error: ${error.response.data.message || "Failed to scrape jobs"}`);
      } else {
        setScrapeMessage("Cannot connect to server. Make sure the server is running.");
      }
    } finally {
      setScraping(false);
    }
  };

  const handleScrapeLinkedInJobs = async () => {
    if (!linkedInJobTitle || linkedInJobTitle.trim() === "") {
      setLinkedInScrapeMessage("Error: Please enter a job title to search");
      return;
    }

    try {
      setScrapingLinkedIn(true);
      setLinkedInScrapeMessage("");
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://localhost:5000/api/jobs/scrape-linkedin",
        { jobTitle: linkedInJobTitle.trim() },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setLinkedInScrapeMessage(`LinkedIn jobs scraped successfully! Found ${response.data.total} Easy Apply jobs.`);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error scraping LinkedIn jobs:", error);
      if (error.response) {
        setLinkedInScrapeMessage(`Error: ${error.response.data.message || "Failed to scrape LinkedIn jobs"}`);
      } else {
        setLinkedInScrapeMessage("Cannot connect to server. Make sure the server is running.");
      }
    } finally {
      setScrapingLinkedIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 overflow-y-auto scrollbar-none p-4">
      <div className="flex justify-between items-center pl-10 pb-5 flex-wrap gap-4">
        <h1 className="text-white text-3xl font-montserrat font-semibold">
          {activeTab === "jobs" ? "Recommended Jobs" : "Applied Jobs"}
        </h1>
        {activeTab === "jobs" && (
          <div className="flex gap-3 items-center flex-wrap">
            {/* Naukri Scrape Button */}
            <button
              onClick={handleScrapeJobs}
              disabled={scraping || scrapingLinkedIn}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold"
            >
              {scraping ? "Scraping..." : "Scrape Jobs from Naukri"}
            </button>
            
            {/* LinkedIn Scrape Section */}
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Search job title..."
                value={linkedInJobTitle}
                onChange={(e) => setLinkedInJobTitle(e.target.value)}
                disabled={scraping || scrapingLinkedIn}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:border-blue-500 disabled:bg-gray-900 disabled:cursor-not-allowed"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !scrapingLinkedIn) {
                    handleScrapeLinkedInJobs();
                  }
                }}
              />
              <button
                onClick={handleScrapeLinkedInJobs}
                disabled={scraping || scrapingLinkedIn || !linkedInJobTitle.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold"
              >
                {scrapingLinkedIn ? "Scraping..." : "Scrape Jobs from LinkedIn"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 pl-10 pb-4">
        <button
          onClick={() => setActiveTab("jobs")}
          className={`px-4 py-2 rounded ${
            activeTab === "jobs"
              ? "bg-blue-500 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Jobs
        </button>
        <button
          onClick={() => setActiveTab("applied")}
          className={`px-4 py-2 rounded ${
            activeTab === "applied"
              ? "bg-blue-500 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          Applied Jobs ({appliedJobs.length})
        </button>
      </div>

      {scrapeMessage && (
        <div
          className={`pl-10 pb-4 ${
            scrapeMessage.includes("Error") ? "text-red-400" : "text-green-400"
          }`}
        >
          {scrapeMessage}
        </div>
      )}
      
      {linkedInScrapeMessage && (
        <div
          className={`pl-10 pb-4 ${
            linkedInScrapeMessage.includes("Error") ? "text-red-400" : "text-green-400"
          }`}
        >
          {linkedInScrapeMessage}
        </div>
      )}

      {activeTab === "jobs" ? (
        <ShowJobs />
      ) : (
        <div className="pl-10">
          {loadingApplied ? (
            <p className="text-white">Loading applied jobs...</p>
          ) : appliedJobs.length === 0 ? (
            <p className="text-white">No applied jobs yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {appliedJobs.map((appliedJob) => (
                <div
                  key={appliedJob._id}
                  className="bg-white/80 text-black p-6 rounded-md"
                >
                  <h3 className="font-bold text-lg">
                    {appliedJob.jobId?.title || "Job Title"}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {appliedJob.jobId?.companyName || "Company"}
                  </p>
                  <p className="text-sm mt-2">
                    Status:{" "}
                    <span
                      className={`font-semibold ${
                        appliedJob.status === "applied"
                          ? "text-green-600"
                          : appliedJob.status === "failed"
                          ? "text-red-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {appliedJob.status.toUpperCase()}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Applied: {new Date(appliedJob.appliedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
