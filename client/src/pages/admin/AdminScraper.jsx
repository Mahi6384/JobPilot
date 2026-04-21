import React, { useEffect, useState } from "react";
import { Play } from "lucide-react";
import api from "../../utils/api";
import Button from "../../components/ui/Button";

function AdminScraper() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [data, setData] = useState(null);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/scraper/summary");
      setData(res.data);
      setRunning(Boolean(res.data?.scraper?.running));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    const t = setInterval(fetchSummary, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (platform) => {
    await api.post("/api/admin/scraper/run", { platform });
    fetchSummary();
  };

  const totalJobs = data?.jobs?.total ?? 0;
  const byPlatform = data?.jobs?.byPlatform ?? {};
  const last = data?.jobs?.last ?? [];
  const lastScrapedAt = data?.scraper?.lastScrapedAt
    ? new Date(data.scraper.lastScrapedAt).toLocaleString()
    : "-";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Scraper</h1>
        <p className="text-sm text-gray-400">
          Trigger scrapes and monitor latest ingested jobs
        </p>
      </div>

      <div className="glass rounded-2xl p-4 mb-6 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="text-sm text-gray-300">
          <div>
            <span className="text-gray-400">Total jobs:</span>{" "}
            <span className="text-white font-semibold">
              {loading ? "…" : totalJobs}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Platforms:{" "}
            {Object.keys(byPlatform).length === 0
              ? "-"
              : Object.entries(byPlatform)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" • ")}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Last scraped: {loading ? "…" : lastScrapedAt}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Play}
            disabled={running}
            onClick={() => run("naukri")}
          >
            Run Naukri
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Play}
            disabled={running}
            onClick={() => run("linkedin")}
          >
            Run LinkedIn
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Play}
            disabled={running}
            onClick={() => run("both")}
          >
            Run Both
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 text-xs text-gray-400">
          Latest scraped jobs
          {running && (
            <span className="ml-2 text-brand-400 font-medium">Running…</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.03] text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-3">Job</th>
                <th className="text-left font-medium px-4 py-3">Platform</th>
                <th className="text-left font-medium px-4 py-3">Scraped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={3}>
                    Loading…
                  </td>
                </tr>
              ) : last.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={3}>
                    No jobs found
                  </td>
                </tr>
              ) : (
                last.map((j) => (
                  <tr key={j._id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{j.title}</div>
                      <div className="text-gray-500 text-xs">
                        {j.company} • {j.location}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {j.platform || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {j.scrapedAt
                        ? new Date(j.scrapedAt).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminScraper;

