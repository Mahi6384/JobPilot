import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, CheckCircle, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import api from "../utils/api";
import StatsCard from "../components/dashboard/StatsCard";
import JobCard from "../components/dashboard/JobCard";
import ExtensionStatus from "../components/dashboard/ExtensionStatus";
import Button from "../components/ui/Button";
import { SkeletonStats, SkeletonCard } from "../components/ui/Skeleton";

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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="skeleton h-8 w-64 mb-2" />
        <div className="skeleton h-4 w-96 mb-8" />
        <SkeletonStats
          count={4}
          className="grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-10"
        />
        <div className="skeleton h-6 w-48 mb-4" />
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Welcome header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-xs font-medium text-brand-400">Dashboard</span>
          </div>
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">
          {getGreeting()},{" "}
          <span className="text-gradient">
            {user?.fullName ? user.fullName.split(" ")[0] : "there"}
          </span>
        </h1>
        <p className="text-gray-400 text-sm">
          Here's an overview of your job search progress
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
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
        <ExtensionStatus />
      </div>

      {/* Top matched jobs */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold text-white">Top Matched Jobs</h2>
          <button
            onClick={() => navigate("/jobs")}
            className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 font-medium transition-colors"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {dashboardData?.topJobs?.length > 0 ? (
            dashboardData.topJobs.map((job, index) => (
              <div
                key={job._id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <JobCard job={job} onClick={() => navigate("/jobs")} />
              </div>
            ))
          ) : jobSearchStatus === "searching" ? (
            <div className="glass rounded-xl p-12 text-center">
              <div className="flex justify-center gap-2 mb-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"
                    style={{ animationDelay: `${i * 200}ms` }}
                  />
                ))}
              </div>
              <p className="text-gray-400 text-sm">
                Analyzing your profile to find perfect job matches...
              </p>
            </div>
          ) : (
            <div className="glass rounded-xl p-12 text-center">
              <p className="text-gray-400">
                Looking for the best jobs matching your profile. Check back
                later!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => navigate("/jobs")}
          variant="primary"
          iconRight={ArrowRight}
        >
          Explore Recommended Jobs
        </Button>
        <Button onClick={() => navigate("/profile")} variant="secondary">
          Edit Profile
        </Button>
      </div>
    </div>
  );
}

export default Home;
