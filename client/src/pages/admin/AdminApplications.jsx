import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api";
import Button from "../../components/ui/Button";

const statuses = ["", "queued", "in_progress", "applied", "failed", "skipped"];
const platforms = ["", "linkedin", "naukri", "indeed", "other"];

function AdminApplications() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [status, setStatus] = useState("");
  const [platform, setPlatform] = useState("");
  const [userId, setUserId] = useState("");
  const [jobId, setJobId] = useState("");

  const fetchApps = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        status: status || undefined,
        platform: platform || undefined,
        userId: userId || undefined,
        jobId: jobId || undefined,
      };
      const res = await api.get("/api/admin/applications", { params });
      setRows(res.data?.data || []);
      setPagination(res.data?.pagination || pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, platform]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Applications</h1>
          <p className="text-sm text-gray-400">Inspect application pipeline</p>
        </div>
        <Link to="/admin/applications/failures">
          <Button variant="secondary">View Failures</Button>
        </Link>
      </div>

      <div className="glass rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Status</label>
            <select
              className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {statuses.map((s) => (
                <option key={s || "all"} value={s}>
                  {s || "All"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Platform</label>
            <select
              className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              {platforms.map((p) => (
                <option key={p || "all"} value={p}>
                  {p || "All"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">User ID</label>
            <input
              className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
              placeholder="Optional"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Job ID</label>
            <input
              className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
              placeholder="Optional"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={() => fetchApps(1)} loading={loading}>
            Apply
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.03] text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-3">User</th>
                <th className="text-left font-medium px-4 py-3">Job</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3">Attempts</th>
                <th className="text-left font-medium px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={5}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={5}>
                    No applications found
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr key={a._id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      {a.userId?._id ? (
                        <Link
                          to={`/admin/users/${a.userId._id}`}
                          className="text-white hover:text-brand-400 font-medium"
                        >
                          {a.userId.fullName || "User"}
                        </Link>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                      <div className="text-gray-500 text-xs">
                        {a.userId?.email || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.jobId?._id ? (
                        <Link
                          to={`/admin/jobs/${a.jobId._id}`}
                          className="text-white hover:text-brand-400 font-medium"
                        >
                          {a.jobId.title || "Job"}
                        </Link>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                      <div className="text-gray-500 text-xs">
                        {a.jobId?.company || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {a.status || "-"}{" "}
                      <span className="text-gray-500">({a.platform || "-"})</span>
                      {a.status === "failed" && a.errorMessage ? (
                        <div className="text-xs text-red-400 truncate max-w-[420px]" title={a.errorMessage}>
                          {a.errorMessage}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{a.attempts ?? 0}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {a.updatedAt ? new Date(a.updatedAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 text-xs text-gray-400">
          <div>
            Page {pagination.page} / {pagination.totalPages} • {pagination.total} total
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchApps(pagination.page - 1)}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchApps(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminApplications;

