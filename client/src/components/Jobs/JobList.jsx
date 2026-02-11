import React from "react";
import JobCard from "../dashboard/JobCard";

function JobList({ jobs, selectedIds, onToggleSelect, onViewDetail, loading }) {
  const MAX_SELECTION = 10;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-48 bg-gray-800 rounded-xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-gray-400 text-lg">No jobs found matching your criteria.</p>
        <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => {
        const isSelected = selectedIds.has(job._id);
        const isDisabled = !isSelected && selectedIds.size >= MAX_SELECTION;

        return (
          <div key={job._id} className={isDisabled ? "opacity-50" : ""}>
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