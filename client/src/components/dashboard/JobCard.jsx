import React from "react";
import { MapPin, Briefcase } from "lucide-react";

function JobCard({ job, onClick, showCheckbox = false, isSelected = false, onToggleSelect }) {
  const platformColors = {
    linkedin: "bg-blue-600",
    naukri: "bg-purple-600",
    indeed: "bg-orange-600",
  };

  const getMatchColor = (score) => {
    if (score >= 80) return "from-green-500 to-emerald-600";
    if (score >= 60) return "from-blue-500 to-cyan-600";
    if (score >= 40) return "from-yellow-500 to-orange-600";
    return "from-red-500 to-pink-600";
  };

  const handleClick = () => {
    if (!showCheckbox && onClick) {
      onClick(job);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-gray-900/50 border rounded-xl p-5 transition-all duration-300 ${
        isSelected ? "border-blue-500 shadow-lg shadow-blue-900/30" : "border-gray-800 hover:border-gray-700"
      } ${!showCheckbox && onClick ? "cursor-pointer hover:scale-[1.02]" : ""}`}
    >
      <div className="flex items-start gap-4">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect?.(job._id);
            }}
            className="mt-1 w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">{job.title}</h3>
              <p className="text-gray-400 text-sm">{job.company}</p>
            </div>
            <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${getMatchColor(job.matchScore)} text-white text-sm font-bold whitespace-nowrap`}>
              {job.matchScore}% Match
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {job.skills?.slice(0, 4).map((skill, idx) => (
              <span key={idx} className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded-md">
                {skill}
              </span>
            ))}
            {job.skills?.length > 4 && (
              <span className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded-md">
                +{job.skills.length - 4} more
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className={`${platformColors[job.platform] || "bg-gray-600"} text-white px-2 py-1 rounded capitalize`}>
              {job.platform}
            </span>
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