import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import api from "../../utils/api";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

function AdminUsers() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [onboardingStatus, setOnboardingStatus] = useState("");
  const [jobSearchStatus, setJobSearchStatus] = useState("");

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        search: search || undefined,
        onboardingStatus: onboardingStatus || undefined,
        jobSearchStatus: jobSearchStatus || undefined,
      };
      const res = await api.get("/api/admin/users", { params });
      setRows(res.data?.data || []);
      setPagination(res.data?.pagination || pagination);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearch("");
    setOnboardingStatus("");
    setJobSearchStatus("");
    fetchUsers(1);
  };

  useEffect(() => {
    fetchUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingStatus, jobSearchStatus]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Users</h1>
        <p className="text-sm text-gray-400">Search and inspect users</p>
      </div>

      <div className="glass rounded-2xl p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <Input
            icon={Search}
            label="Search"
            placeholder="Email or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            containerClassName="flex-1"
          />

          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">
                Onboarding
              </label>
              <select
                className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
                value={onboardingStatus}
                onChange={(e) => setOnboardingStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="initial">initial</option>
                <option value="profile_completed">profile_completed</option>
                <option value="naukri_connected">naukri_connected</option>
                <option value="completed">completed</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">
                Job Search
              </label>
              <select
                className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
                value={jobSearchStatus}
                onChange={(e) => setJobSearchStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="idle">idle</option>
                <option value="searching">searching</option>
                <option value="ready">ready</option>
              </select>
            </div>

            <Button
              variant="secondary"
              onClick={() => fetchUsers(1)}
              loading={loading}
            >
              Apply
            </Button>
            <Button variant="ghost" onClick={handleClear} disabled={loading}>
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.03] text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-3">User</th>
                <th className="text-left font-medium px-4 py-3">Onboarding</th>
                <th className="text-left font-medium px-4 py-3">
                  Job Search
                </th>
                <th className="text-left font-medium px-4 py-3">Admin</th>
                <th className="text-left font-medium px-4 py-3">Created</th>
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
                    No users found
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u._id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/users/${u._id}`}
                        className="text-white hover:text-brand-400 font-medium"
                      >
                        {u.fullName || "User"}
                      </Link>
                      <div className="text-gray-500 text-xs">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {u.onboardingStatus || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {u.jobSearchStatus || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {u.isAdmin ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 text-xs text-gray-400">
          <div>
            Page {pagination.page} / {pagination.totalPages} • {pagination.total}{" "}
            total
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchUsers(pagination.page - 1)}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchUsers(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminUsers;

