import React from "react";
import { MapPin, Briefcase, Zap } from "lucide-react";
import Badge from "../ui/Badge";

function JobCard({ job, onClick, showCheckbox = false, isSelected = false, onToggleSelect }) {
  const platformColors = {
    linkedin: "info",
    naukri: "purple",
    indeed: "warning",
  };

  const getMatchColor = (score) => {
    if (score >= 80) return "success";
    if (score >= 60) return "info";
    if (score >= 40) return "warning";
    return "error";
  };

  const handleClick = () => {
    if (!showCheckbox && onClick) {
      onClick(job);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        glass rounded-xl p-5 transition-all duration-300
        ${isSelected
          ? "border-brand-500/50 bg-brand-500/5 shadow-glow"
          : "hover:bg-white/[0.05] hover:border-white/[0.1]"
        }
        ${!showCheckbox && onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover" : ""}
      `}
    >
      <div className="flex items-start gap-4">
        {showCheckbox && (
          <div className="pt-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect?.(job._id);
              }}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
            />
          </div>
        )}

        {/* Company initial avatar */}
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-semibold text-gray-400 flex-shrink-0">
          {job.company?.charAt(0).toUpperCase() || "?"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">
                {job.title}
              </h3>
              <p className="text-gray-400 text-xs mt-0.5">{job.company}</p>
            </div>
            <Badge color={getMatchColor(job.matchScore)} size="sm">
              {job.matchScore}% Match
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {job.skills?.slice(0, 4).map((skill, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-white/5 text-gray-400 text-[11px] rounded-md border border-white/[0.06]"
              >
                {skill}
              </span>
            ))}
            {job.skills?.length > 4 && (
              <span className="px-2 py-0.5 text-gray-500 text-[11px]">
                +{job.skills.length - 4}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-xs text-gray-500 flex-wrap">
            <Badge color={platformColors[job.platform] || "default"} size="sm">
              {job.platform}
            </Badge>
            {job.platform === "linkedin" && job.applyType === "easy_apply" && (
              <Badge color="success" size="sm" dot>
                Easy Apply
              </Badge>
            )}
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {job.location}
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              {job.jobType}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobCard;
