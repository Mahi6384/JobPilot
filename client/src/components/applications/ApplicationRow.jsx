import React from "react";
import StatusBadge from "./StatusBadge";

function ApplicationRow({ application, onRetry }) {
  const job = application.jobId || {};
  const appliedDate = new Date(
    application.appliedAt || application.createdAt
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const canRetry = ["failed", "skipped"].includes(application.status);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-gray-700 transition-colors">
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-semibold text-lg truncate">
          {job.title || "Unknown Job"}
        </h3>
        <p className="text-gray-400 text-sm">
          {job.company || "Unknown Company"}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          <span className="bg-purple-600 text-white px-2 py-0.5 rounded capitalize">
            {application.platform || job.platform || "N/A"}
          </span>
          {job.location && <span>{job.location}</span>}
          <span>{appliedDate}</span>
          {application.errorMessage && (
            <span className="text-red-400 truncate max-w-[200px]" title={application.errorMessage}>
              {application.errorMessage}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusBadge status={application.status} />
        {canRetry && onRetry && (
          <button
            onClick={() => onRetry(application._id)}
            className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition-colors font-medium"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export default ApplicationRow;
