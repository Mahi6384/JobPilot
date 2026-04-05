import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../utils/api";
import ApplicationRow from "../components/applications/ApplicationRow";

const TABS = [
  { key: "all", label: "All" },
  { key: "queued", label: "Queued" },
  { key: "in_progress", label: "In Progress" },
  { key: "applied", label: "Applied" },
  { key: "failed", label: "Failed" },
  { key: "skipped", label: "Skipped" },
];

function Applications() {
  const [applications, setApplications] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const hasActiveJobs =
    (stats.queued || 0) > 0 || (stats.in_progress || 0) > 0;

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get("/api/applications/stats");
      setStats(response.data.data || {});
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  const fetchApplications = useCallback(async () => {
    try {
      const params = activeTab !== "all" ? { status: activeTab } : {};
      params.limit = 50;
      const response = await api.get("/api/applications", { params });
      setApplications(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch applications:", error);
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchApplications()]).finally(() =>
      setLoading(false)
    );
  }, [activeTab, fetchStats, fetchApplications]);

  useEffect(() => {
    if (!hasActiveJobs) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(() => {
      fetchApplications();
      fetchStats();
    }, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasActiveJobs, fetchApplications, fetchStats]);

  const handleRetry = useCallback(
    async (applicationId) => {
      try {
        await api.post(`/api/applications/${applicationId}/retry`);
        fetchApplications();
        fetchStats();
      } catch (error) {
        const msg = error.response?.data?.message || "Retry failed";
        alert(msg);
      }
    },
    [fetchApplications, fetchStats]
  );

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">
          Your Application Journey
        </h1>
        <p className="text-gray-400 mb-8">
          Monitor and manage your job application progress in one place
          {hasActiveJobs && (
            <span className="ml-2 inline-flex items-center gap-1 text-blue-400 text-sm">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              Live updating
            </span>
          )}
        </p>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Total", value: stats.total || 0, color: "text-white" },
            {
              label: "Applied",
              value: stats.applied || 0,
              color: "text-green-400",
            },
            {
              label: "Queued",
              value: stats.queued || 0,
              color: "text-yellow-400",
            },
            {
              label: "In Progress",
              value: stats.in_progress || 0,
              color: "text-blue-400",
            },
            {
              label: "Failed",
              value: stats.failed || 0,
              color: "text-red-400",
            },
            {
              label: "Skipped",
              value: stats.skipped || 0,
              color: "text-gray-400",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center"
            >
              <p className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </p>
              <p className="text-gray-400 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Success Rate + Today */}
        {stats.successRate !== undefined && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-6 flex items-center justify-between">
            <span className="text-gray-400">Success Rate</span>
            <span className="text-2xl font-bold text-purple-400">
              {stats.successRate}%
            </span>
            {stats.appliedToday > 0 && (
              <span className="text-green-400 text-sm font-medium">
                {stats.appliedToday} applied today
              </span>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-3 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {tab.label}
              {stats[tab.key] !== undefined && tab.key !== "all" && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({stats[tab.key]})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Application List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-gray-800 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-gray-400 text-lg">
              {activeTab === "all"
                ? "You haven't applied to any jobs yet"
                : `No ${activeTab.replace("_", " ")} applications`}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Head over to the Jobs section and start applying!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <ApplicationRow
                key={app._id}
                application={app}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Applications;
