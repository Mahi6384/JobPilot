import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../utils/api";
import Button from "../../components/ui/Button";

function AdminUserDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get(`/api/admin/users/${id}`)
      .then((res) => {
        if (mounted) setData(res.data?.data || null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  const user = data?.user;
  const stats = data?.stats;
  const byStatus = stats?.applicationsByStatus || {};

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">User</h1>
          <p className="text-sm text-gray-400">{id}</p>
        </div>
        <Link to="/admin/users">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : !user ? (
        <div className="text-gray-500">User not found</div>
      ) : (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white font-semibold text-lg">
                  {user.fullName || "User"}
                </div>
                <div className="text-gray-400 text-sm">{user.email}</div>
                <div className="text-gray-500 text-xs mt-2">
                  Created:{" "}
                  {user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}
                </div>
              </div>
              <div className="text-right text-xs text-gray-400">
                <div>Onboarding: {user.onboardingStatus || "-"}</div>
                <div>Job search: {user.jobSearchStatus || "-"}</div>
                <div>Admin: {user.isAdmin ? "Yes" : "No"}</div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              Application Stats
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-gray-400 text-xs">Total</div>
                <div className="text-white font-semibold">
                  {stats?.applicationsTotal ?? 0}
                </div>
              </div>
              {["queued", "in_progress", "applied", "failed", "skipped"].map(
                (k) => (
                  <div
                    key={k}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/5"
                  >
                    <div className="text-gray-400 text-xs capitalize">
                      {k.replace("_", " ")}
                    </div>
                    <div className="text-white font-semibold">
                      {byStatus[k] ?? 0}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="text-gray-400">
                Phone: <span className="text-gray-200">{user.phone || "-"}</span>
              </div>
              <div className="text-gray-400">
                Location:{" "}
                <span className="text-gray-200">{user.location || "-"}</span>
              </div>
              <div className="text-gray-400">
                Target role:{" "}
                <span className="text-gray-200">
                  {user.targetJobTitle || "-"}
                </span>
              </div>
              <div className="text-gray-400">
                Experience:{" "}
                <span className="text-gray-200">
                  {user.yearsOfExperience ?? "-"}
                </span>
              </div>
              <div className="text-gray-400">
                Resume URL:{" "}
                <span className="text-gray-200 break-all">
                  {user.resumeUrl || "-"}
                </span>
              </div>
              <div className="text-gray-400">
                LinkedIn URL:{" "}
                <span className="text-gray-200 break-all">
                  {user.linkedinUrl || "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUserDetail;

