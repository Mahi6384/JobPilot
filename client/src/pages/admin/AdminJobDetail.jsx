import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../utils/api";
import Button from "../../components/ui/Button";

function AdminJobDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get(`/api/admin/jobs/${id}`)
      .then((res) => {
        if (mounted) setJob(res.data?.data || null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Job</h1>
          <p className="text-sm text-gray-400">{id}</p>
        </div>
        <Link to="/admin/jobs">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : !job ? (
        <div className="text-gray-500">Job not found</div>
      ) : (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <div className="text-white font-semibold text-lg">{job.title}</div>
            <div className="text-gray-400 text-sm">
              {job.company} • {job.location}
            </div>
            <div className="text-gray-500 text-xs mt-2">
              Platform: {job.platform} • Type: {job.jobType} • Easy apply:{" "}
              {job.easyApply ? "Yes" : "No"}
            </div>
            <div className="text-gray-500 text-xs mt-1">
              Scraped:{" "}
              {job.scrapedAt ? new Date(job.scrapedAt).toLocaleString() : "-"}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Apply URL</h2>
            <a
              className="text-brand-400 hover:text-brand-300 text-sm break-all"
              href={job.applicationUrl}
              target="_blank"
              rel="noreferrer"
            >
              {job.applicationUrl}
            </a>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Description</h2>
            <div className="text-sm text-gray-300 whitespace-pre-wrap">
              {job.description || "-"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminJobDetail;

