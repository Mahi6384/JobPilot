import React from "react";
import { X, ExternalLink, MapPin, Briefcase, DollarSign, Clock } from "lucide-react";

function JobDetail({ job, onClose }) {
  if (!job) return null;

  const getMatchColor = (score) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-blue-400";
    if (score >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">{job.title}</h2>
            <p className="text-gray-400">{job.company}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Match Score */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`text-4xl font-bold ${getMatchColor(job.matchScore)}`}>
              {job.matchScore}%
            </div>
            <span className="text-gray-400">Match Score</span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-2 text-gray-300">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm">{job.location}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Briefcase className="w-4 h-4 text-gray-400" />
              <span className="text-sm capitalize">{job.jobType}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="text-sm">₹{job.salaryMin} - ₹{job.salaryMax} LPA</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm">{job.experienceMin} - {job.experienceMax} years</span>
            </div>
          </div>

          {/* Platform Badge */}
          <div className="mb-6">
            <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full capitalize">
              {job.platform}
            </span>
          </div>

          {/* Skills */}
          <div className="mb-6">
            <h3 className="text-white font-semibold mb-3">Required Skills</h3>
            <div className="flex flex-wrap gap-2">
              {job.skills?.map((skill, idx) => (
                <span key={idx} className="px-3 py-1 bg-gray-800 text-gray-300 text-sm rounded-md">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          {job.description && (
            <div className="mb-6">
              <h3 className="text-white font-semibold mb-3">Description</h3>
              <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </div>
          )}

          {/* Apply Button */}
          <button
            onClick={() => window.open(job.applicationUrl, "_blank")}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            Apply Now
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default JobDetail;