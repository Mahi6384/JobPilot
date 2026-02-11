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

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(userData);
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get("/api/jobs/dashboard");
      setDashboardData(response.data);
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
          <div className="h-8 w-64 bg-gray-800 rounded animate-pulse mb-4"></div>
          <div className="h-4 w-96 bg-gray-800 rounded animate-pulse mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-800 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome back, {user?.fullName || "User"}! 👋
          </h1>
          <p className="text-gray-400">Here's your job search overview</p>
        </div>

        {/* Stats Row */}
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

        {/* Top Matched Jobs */}
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
                <JobCard key={job._id} job={job} onClick={() => navigate("/jobs")} />
              ))
            ) : (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-12 text-center">
                <p className="text-gray-400">No matched jobs yet. Check back soon!</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate("/jobs")}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Browse All Jobs
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