import React, { useState, useEffect } from "react";
import api from "../utils/api";
import ApplicationRow from "../components/applications/ApplicationRow";

const TABS = [
  { key: "all", label: "All" },
  { key: "queued", label: "Queued" },
  { key: "applied", label: "Applied" },
  { key: "failed", label: "Failed" },
  { key: "review_needed", label: "Needs Review" },
];

function Applications() {
  const [applications, setApplications] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const response = await api.get("/api/applications/stats");
      setStats(response.data.data || {});
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = activeTab !== "all" ? { status: activeTab } : {};
      const response = await api.get("/api/applications", { params });
      setApplications(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch applications:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Your Application Journey</h1>
        <p className="text-gray-400 mb-8">Monitor and manage your job application progress in one place</p>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
              label: "Failed",
              value: stats.failed || 0,
              color: "text-red-400",
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

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-3">
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
              ></div>
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-gray-400 text-lg">You haven't applied to any jobs yet</p>
            <p className="text-gray-500 text-sm mt-2">
              Head over to the Jobs section and start applying to find your dream role!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <ApplicationRow key={app._id} application={app} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Applications;
