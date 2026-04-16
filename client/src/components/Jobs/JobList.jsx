import React from "react";
import { Search } from "lucide-react";
import JobCard from "../dashboard/JobCard";
import { SkeletonCard } from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";

function JobList({ jobs, selectedIds, onToggleSelect, onViewDetail, loading }) {
  const MAX_SELECTION = 10;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No jobs found"
        description="We couldn't find any jobs matching your current criteria. Try adjusting your filters."
      />
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job, index) => {
        const isSelected = selectedIds.has(job._id);
        const isDisabled = !isSelected && selectedIds.size >= MAX_SELECTION;

        return (
          <div
            key={job._id}
            className={`animate-fade-in-up ${isDisabled ? "opacity-50" : ""}`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <JobCard
              job={job}
              showCheckbox={true}
              isSelected={isSelected}
              onToggleSelect={isDisabled ? null : onToggleSelect}
              onClick={() => onViewDetail(job)}
            />
          </div>
        );
      })}
    </div>
  );
}

export default JobList;
