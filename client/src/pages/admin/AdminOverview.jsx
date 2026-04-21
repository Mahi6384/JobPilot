import React, { useEffect, useState } from "react";
import { Users, Briefcase, AlertTriangle } from "lucide-react";
import api from "../../utils/api";
import StatsCard from "../../components/dashboard/StatsCard";

function AdminOverview() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    api
      .get("/api/admin/overview")
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const usersTotal = data?.users?.total ?? 0;
  const usersNewLast7d = data?.users?.newLast7d ?? 0;
  const jobsTotal = data?.jobs?.total ?? 0;
  const jobsLast24h = data?.jobs?.last24h ?? 0;
  const jobsLast7d = data?.jobs?.last7d ?? 0;
  const failedLast24h = data?.applications?.failedLast24h ?? 0;
  const byStatus = data?.applications?.byStatus ?? {};

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Admin Overview</h1>
        <p className="text-sm text-gray-400">System health and KPIs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatsCard
          icon={Users}
          value={loading ? "…" : usersTotal}
          label="Total Users"
          color="blue"
        />
        <StatsCard
          icon={Users}
          value={loading ? "…" : usersNewLast7d}
          label="New Users (7d)"
          color="green"
        />
        <StatsCard
          icon={Briefcase}
          value={loading ? "…" : jobsTotal}
          label="Total Jobs"
          color="purple"
        />
        <StatsCard
          icon={AlertTriangle}
          value={loading ? "…" : failedLast24h}
          label="Failed Apps (24h)"
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Jobs Added</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-300">
              <span>Last 24h</span>
              <span className="text-white font-semibold">
                {loading ? "…" : jobsLast24h}
              </span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Last 7d</span>
              <span className="text-white font-semibold">
                {loading ? "…" : jobsLast7d}
              </span>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            Applications by Status
          </h2>
          <div className="space-y-2 text-sm">
            {["queued", "in_progress", "applied", "failed", "skipped"].map(
              (k) => (
                <div key={k} className="flex justify-between text-gray-300">
                  <span className="capitalize">{k.replace("_", " ")}</span>
                  <span className="text-white font-semibold">
                    {loading ? "…" : byStatus[k] ?? 0}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            Top Errors (7d)
          </h2>
          <div className="space-y-2 text-sm">
            {(data?.applications?.topErrors || []).length === 0 ? (
              <div className="text-gray-500">
                {loading ? "Loading…" : "No recent errors"}
              </div>
            ) : (
              (data?.applications?.topErrors || []).map((e) => (
                <div
                  key={e.errorMessage}
                  className="flex justify-between gap-3 text-gray-300"
                >
                  <span className="truncate" title={e.errorMessage}>
                    {e.errorMessage}
                  </span>
                  <span className="text-white font-semibold">{e.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminOverview;

