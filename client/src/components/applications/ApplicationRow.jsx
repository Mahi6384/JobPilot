import React from "react";
import StatusBadge from "./StatusBadge";

function ApplicationRow({ application }) {
  const job = application.jobId || {};
  const appliedDate = new Date(application.createdAt).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-gray-700 transition-colors">
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-semibold text-lg">
          {job.title || "Unknown Job"}
        </h3>
        <p className="text-gray-400 text-sm">
          {job.company || "Unknown Company"}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          <span className="bg-purple-600 text-white px-2 py-0.5 rounded capitalize">
            {application.platform || job.platform || "N/A"}
          </span>
          <span>{job.location || ""}</span>
          <span>{appliedDate}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={application.status} />
        {application.status === "failed" && (
          <button className="px-3 py-1 bg-red-600/20 text-red-400 rounded-lg text-xs hover:bg-red-600/30 transition-colors">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export default ApplicationRow;
