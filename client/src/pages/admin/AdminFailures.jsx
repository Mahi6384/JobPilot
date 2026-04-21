import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api";
import Button from "../../components/ui/Button";

function AdminFailures() {
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState("errorMessage");
  const [sinceDays, setSinceDays] = useState(7);
  const [rows, setRows] = useState([]);

  const fetchFailures = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/applications/failures", {
        params: { groupBy, sinceDays },
      });
      setRows(res.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFailures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, sinceDays]);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Failures</h1>
          <p className="text-sm text-gray-400">Grouped view of failed applications</p>
        </div>
        <Link to="/admin/applications">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <div className="glass rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-300">Group by</label>
          <select
            className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          >
            <option value="errorMessage">errorMessage</option>
            <option value="platform">platform</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-300">Since (days)</label>
          <input
            type="number"
            min={1}
            max={365}
            className="h-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 w-40"
            value={sinceDays}
            onChange={(e) => setSinceDays(Number(e.target.value || 7))}
          />
        </div>
        <Button variant="secondary" onClick={fetchFailures} loading={loading}>
          Refresh
        </Button>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.03] text-gray-400">
            <tr>
              <th className="text-left font-medium px-4 py-3">Key</th>
              <th className="text-left font-medium px-4 py-3 w-32">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={2}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={2}>
                  No failures found
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={String(r.key)} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-gray-200 break-all">{r.key}</td>
                  <td className="px-4 py-3 text-white font-semibold">{r.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminFailures;

