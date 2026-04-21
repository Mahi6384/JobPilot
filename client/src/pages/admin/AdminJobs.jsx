import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Search, Trash2 } from "lucide-react";
import api from "../../utils/api";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

function AdminJobs() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
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
  const [sort, setSort] = useState("desc");

  const selectedCount = selected.size;

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
        sort,
      };
      const res = await api.get("/api/admin/jobs", { params });
      setRows(res.data?.data || []);
      setPagination(res.data?.pagination || pagination);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearch("");
    setPlatform("");
    setDateFrom("");
    setDateTo("");
    setSort("desc");
    fetchJobs(1);
  };

  const allIdsOnPage = useMemo(() => rows.map((r) => r._id), [rows]);
  const allSelectedOnPage =
    allIdsOnPage.length > 0 && allIdsOnPage.every((id) => selected.has(id));

  const toggleSelectAllOnPage = () => {
    const next = new Set(selected);
    if (allSelectedOnPage) {
      allIdsOnPage.forEach((id) => next.delete(id));
    } else {
      allIdsOnPage.forEach((id) => next.add(id));
    }
    setSelected(next);
  };

  const toggleOne = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleDeleteOne = async (id) => {
    const ok = window.confirm("Delete this job? It will be hidden from all users.");
    if (!ok) return;
    await api.delete(`/api/admin/jobs/${id}`);
    fetchJobs(pagination.page);
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    const ok = window.confirm(
      `Delete ${selected.size} job(s)? They will be hidden from all users.`,
    );
    if (!ok) return;
    await api.post("/api/admin/jobs/bulk-delete", { jobIds: [...selected] });
    fetchJobs(pagination.page);
  };

  useEffect(() => {
    fetchJobs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, sort]);

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
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Sort</label>
              <select
                className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="desc">Newest</option>
                <option value="asc">Oldest</option>
              </select>
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="text-xs text-gray-400">
            {selectedCount > 0 ? (
              <span className="text-gray-200 font-medium">
                {selectedCount} selected
              </span>
            ) : (
              <span>Select jobs to bulk delete</span>
            )}
          </div>
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            disabled={selectedCount === 0 || loading}
            onClick={handleDeleteSelected}
          >
            Delete Selected
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.03] text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={toggleSelectAllOnPage}
                  />
                </th>
                <th className="text-left font-medium px-4 py-3">Job</th>
                <th className="text-left font-medium px-4 py-3">Platform</th>
                <th className="text-left font-medium px-4 py-3">Type</th>
                <th className="text-left font-medium px-4 py-3">Failures</th>
                <th className="text-left font-medium px-4 py-3">Scraped</th>
                <th className="text-left font-medium px-4 py-3 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={7}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={7}>
                    No jobs found
                  </td>
                </tr>
              ) : (
                rows.map((j) => (
                  <tr key={j._id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(j._id)}
                        onChange={() => toggleOne(j._id)}
                      />
                    </td>
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
                      <div className="flex items-center gap-2">
                        <span>{j.failedCount ?? 0}</span>
                        {(j.failedCount ?? 0) >= 3 && (
                          <span
                            title="This job failed multiple times"
                            className="inline-flex items-center gap-1 text-xs text-amber-400"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            risky
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {j.scrapedAt ? new Date(j.scrapedAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={loading}
                        onClick={() => handleDeleteOne(j._id)}
                      >
                        Delete
                      </Button>
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

