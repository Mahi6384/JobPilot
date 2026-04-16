import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  CheckCircle,
  Clock,
  Loader,
  XCircle,
  SkipForward,
  BarChart3,
} from "lucide-react";
import api from "../utils/api";
import ApplicationRow from "../components/applications/ApplicationRow";
import { SkeletonCard } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";

const TABS = [
  { key: "all", label: "All" },
  { key: "queued", label: "Queued" },
  { key: "in_progress", label: "In Progress" },
  { key: "applied", label: "Applied" },
  { key: "failed", label: "Failed" },
  { key: "skipped", label: "Skipped" },
];

const statIcons = {
  Total: FileText,
  Applied: CheckCircle,
  Queued: Clock,
  "In Progress": Loader,
  Failed: XCircle,
  Skipped: SkipForward,
};

const statColors = {
  Total: "text-white",
  Applied: "text-emerald-400",
  Queued: "text-amber-400",
  "In Progress": "text-blue-400",
  Failed: "text-red-400",
  Skipped: "text-gray-400",
};

function Applications() {
  const toast = useToast();
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
      setLoading(false),
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
        toast.success("Application re-queued");
      } catch (error) {
        toast.error(error.response?.data?.message || "Retry failed");
      }
    },
    [fetchApplications, fetchStats, toast],
  );

  const statItems = [
    { label: "Total", value: stats.total || 0 },
    { label: "Applied", value: stats.applied || 0 },
    { label: "Queued", value: stats.queued || 0 },
    { label: "In Progress", value: stats.in_progress || 0 },
    { label: "Failed", value: stats.failed || 0 },
    { label: "Skipped", value: stats.skipped || 0 },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">
          Your Applications
        </h1>
        <p className="text-sm text-gray-400">
          Monitor and manage your job application progress
          {hasActiveJobs && (
            <span className="ml-2 inline-flex items-center gap-1.5 text-brand-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" />
              Live updating
            </span>
          )}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        {statItems.map((stat) => {
          const Icon = statIcons[stat.label] || FileText;
          return (
            <div
              key={stat.label}
              className="glass rounded-xl p-4 text-center hover:bg-white/[0.05] transition-all"
            >
              <Icon
                className={`w-4 h-4 mx-auto mb-2 ${statColors[stat.label] || "text-gray-400"}`}
              />
              <p className={`text-xl font-bold ${statColors[stat.label]}`}>
                {stat.value}
              </p>
              <p className="text-gray-500 text-[11px] mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Success rate */}
      {stats.successRate !== undefined && (
        <div className="glass rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-400">Success Rate</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-purple-400">
              {stats.successRate}%
            </span>
            {stats.appliedToday > 0 && (
              <span className="text-xs text-emerald-400 font-medium">
                {stats.appliedToday} applied today
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
              ${activeTab === tab.key
                ? "bg-brand-500 text-white shadow-glow"
                : "text-gray-400 hover:text-white hover:bg-white/5"
              }
            `}
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

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            activeTab === "all"
              ? "No applications yet"
              : `No ${activeTab.replace("_", " ")} applications`
          }
          description="Head over to the Jobs section and start applying!"
        />
      ) : (
        <div className="space-y-3">
          {applications.map((app, index) => (
            <div
              key={app._id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <ApplicationRow application={app} onRetry={handleRetry} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Applications;
