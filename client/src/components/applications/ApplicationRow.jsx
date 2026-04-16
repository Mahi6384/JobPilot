import React from "react";
import { MapPin, RotateCcw } from "lucide-react";
import StatusBadge from "./StatusBadge";
import Badge from "../ui/Badge";
import Button from "../ui/Button";

function ApplicationRow({ application, onRetry }) {
  const job = application.jobId || {};
  const appliedDate = new Date(
    application.appliedAt || application.createdAt,
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const canRetry = ["failed", "skipped"].includes(application.status);

  return (
    <div className="glass rounded-xl p-5 flex items-center justify-between hover:bg-white/[0.05] transition-all duration-200 group">
      <div className="flex items-start gap-4 flex-1 min-w-0">
        {/* Company avatar */}
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-semibold text-gray-400 flex-shrink-0">
          {job.company?.charAt(0).toUpperCase() || "?"}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate group-hover:text-brand-300 transition-colors">
            {job.title || "Unknown Job"}
          </h3>
          <p className="text-gray-400 text-xs mt-0.5">
            {job.company || "Unknown Company"}
          </p>
          <div className="flex items-center gap-2.5 mt-2 flex-wrap">
            <Badge
              color={
                application.platform === "linkedin"
                  ? "info"
                  : application.platform === "naukri"
                    ? "purple"
                    : "default"
              }
              size="sm"
            >
              {application.platform || job.platform || "N/A"}
            </Badge>
            {job.location && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3" />
                {job.location}
              </span>
            )}
            <span className="text-xs text-gray-500">{appliedDate}</span>
            {application.errorMessage && (
              <span
                className="text-xs text-red-400 truncate max-w-[200px]"
                title={application.errorMessage}
              >
                {application.errorMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        <StatusBadge status={application.status} />
        {canRetry && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={() => onRetry(application._id)}
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

export default ApplicationRow;
