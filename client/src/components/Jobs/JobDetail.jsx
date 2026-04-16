import React from "react";
import {
  X,
  ExternalLink,
  MapPin,
  Briefcase,
  IndianRupee,
  Clock,
  Zap,
} from "lucide-react";
import Badge from "../ui/Badge";
import Button from "../ui/Button";

function JobDetail({ job, onClose }) {
  if (!job) return null;

  const getMatchColor = (score) => {
    if (score >= 80) return "success";
    if (score >= 60) return "info";
    if (score >= 40) return "warning";
    return "error";
  };

  const getApplyTypeInfo = () => {
    if (job.platform !== "linkedin") return null;

    if (job.applyType === "easy_apply") {
      return (
        <div className="flex items-start gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
          <Zap className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-emerald-400 font-medium text-sm">
              LinkedIn Easy Apply
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Our extension can auto-apply for you!
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
        <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-gray-400 font-medium text-sm">
            Classification Pending
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Still checking Easy Apply status.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl glass-strong shadow-glass animate-slide-in-right flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/[0.06]">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-1">{job.title}</h2>
            <p className="text-gray-400 text-sm">{job.company}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Match + Platform */}
          <div className="flex items-center gap-3">
            <Badge color={getMatchColor(job.matchScore)} size="md">
              {job.matchScore}% Match
            </Badge>
            <Badge color="default" size="md">
              {job.platform}
            </Badge>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: MapPin, text: job.location },
              { icon: Briefcase, text: job.jobType },
              {
                icon: IndianRupee,
                text: `${job.salaryMin || 0} - ${job.salaryMax || 0} LPA`,
              },
              {
                icon: Clock,
                text: `${job.experienceMin || 0} - ${job.experienceMax || 0} yrs`,
              },
            ].map(({ icon: Icon, text }, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
              >
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-300 capitalize">{text}</span>
              </div>
            ))}
          </div>

          {/* Apply type */}
          {getApplyTypeInfo()}

          {/* Skills */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              Required Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {job.skills?.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-white/5 text-gray-300 text-xs rounded-lg border border-white/[0.06]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          {job.description && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">
                Description
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/[0.06]">
          <Button
            onClick={() => window.open(job.applicationUrl, "_blank")}
            variant="primary"
            size="lg"
            iconRight={ExternalLink}
            className="w-full"
          >
            Apply Now
          </Button>
        </div>
      </div>
    </div>
  );
}

export default JobDetail;
