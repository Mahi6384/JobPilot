import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import api from "../../utils/api";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

function AdminJobs() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchJobs = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        search: search || undefined,
        platform: platform || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      const res = await api.get("/api/admin/jobs", { params });
      setRows(res.data?.data || []);
      setPagination(res.data?.pagination || pagination);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearch("");
    setPlatform("");
    setDateFrom("");
    setDateTo("");
    fetchJobs(1);
  };

  useEffect(() => {
    fetchJobs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Jobs</h1>
        <p className="text-sm text-gray-400">Browse ingested jobs</p>
      </div>

      <div className="glass rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end">
          <Input
            icon={Search}
            label="Search"
            placeholder="Title, company, location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Platform</label>
            <select
              className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option value="">All</option>
              <option value="linkedin">linkedin</option>
              <option value="naukri">naukri</option>
              <option value="indeed">indeed</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">From</label>
            <input
              type="date"
              className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">To</label>
              <input
                type="date"
                className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 w-full"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={() => fetchJobs(1)} loading={loading}>
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
                <th className="text-left font-medium px-4 py-3">Job</th>
                <th className="text-left font-medium px-4 py-3">Platform</th>
                <th className="text-left font-medium px-4 py-3">Type</th>
                <th className="text-left font-medium px-4 py-3">Scraped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={4}>
                    No jobs found
                  </td>
                </tr>
              ) : (
                rows.map((j) => (
                  <tr key={j._id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/jobs/${j._id}`}
                        className="text-white hover:text-brand-400 font-medium"
                      >
                        {j.title}
                      </Link>
                      <div className="text-gray-500 text-xs">
                        {j.company} • {j.location}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {j.platform || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {j.jobType || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {j.scrapedAt ? new Date(j.scrapedAt).toLocaleString() : "-"}
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
              onClick={() => fetchJobs(pagination.page - 1)}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchJobs(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminJobs;

