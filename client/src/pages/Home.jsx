import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, CheckCircle, TrendingUp, Plug } from "lucide-react";
import api from "../utils/api";
import StatsCard from "../components/dashboard/StatsCard";
import JobCard from "../components/dashboard/JobCard";
import ExtensionStatus from "../components/dashboard/ExtensionStatus";

function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [user, setUser] = useState(null);
  const [jobSearchStatus, setJobSearchStatus] = useState("idle");

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(userData);
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [dashResponse, statusResponse] = await Promise.all([
        api.get("/api/jobs/dashboard"),
        api.get("/api/jobs/search-status"),
      ]);
      setDashboardData(dashResponse.data);
      setJobSearchStatus(statusResponse.data.jobSearchStatus);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-8 w-64 bg-gray-800 rounded animate-pulse mb-4" />
          <div className="h-4 w-96 bg-gray-800 rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 bg-gray-800 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h3 className="text-3xl font-bold text-white mb-2">
            Welcome {user?.fullName ? user.fullName.split(" ")[0] : "User"}!
          </h3>
          <p className="text-gray-400">
            Here is a quick overview of your job search progress
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatsCard
            icon={Briefcase}
            value={dashboardData?.stats?.totalMatches || 0}
            label="Total Matches"
            color="blue"
          />
          <StatsCard
            icon={CheckCircle}
            value={dashboardData?.stats?.appliedToday || 0}
            label="Applied Today"
            color="green"
          />
          <StatsCard
            icon={TrendingUp}
            value={`${dashboardData?.stats?.successRate || 0}%`}
            label="Success Rate"
            color="purple"
          />
          <div>
            <ExtensionStatus />
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Top Matched Jobs</h2>
            <button
              onClick={() => navigate("/jobs")}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              View All Jobs →
            </button>
          </div>

          <div className="space-y-4">
            {dashboardData?.topJobs?.length > 0 ? (
              dashboardData.topJobs.map((job) => (
                <JobCard
                  key={job._id}
                  job={job}
                  onClick={() => navigate("/jobs")}
                />
              ))
            ) : jobSearchStatus === "searching" ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-12 text-center">
                <p className="text-gray-500 text-sm">
                  Analyzing your profile to find perfect job matches. This
                  usually takes about a minute — hang tight!
                </p>
              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-12 text-center">
                <p className="text-gray-400">
                  Looking for the best jobs matching your profile. Check back
                  later!
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate("/jobs")}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Explore Recommended Jobs
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
