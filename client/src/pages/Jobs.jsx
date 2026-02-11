import React, { useState, useEffect } from "react";
import api from "../utils/api";
import JobFilters from "../components/jobs/JobFilters";
import JobList from "../components/jobs/JobList";
import JobDetail from "../components/jobs/JobDetail";
import ApplyBar from "../components/jobs/ApplyBar";

function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [detailJob, setDetailJob] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [filters, pagination.page]);

  const fetchFilterOptions = async () => {
    try {
      const response = await api.get("/api/jobs/filters");
      setFilterOptions(response.data);
    } catch (error) {
      console.error("Failed to fetch filter options:", error);
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        platform: filters.platform?.join(","),
        jobType: filters.jobType?.join(","),
        page: pagination.page,
        limit: 10,
      };

      const response = await api.get("/api/jobs", { params });
      setJobs(response.data.jobs);
      setPagination({
        page: response.data.page,
        totalPages: response.data.totalPages,
        total: response.data.total,
      });
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (jobId) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(jobId)) {
      newSelection.delete(jobId);
    } else if (newSelection.size < 10) {
      newSelection.add(jobId);
    }
    setSelectedIds(newSelection);
  };

  const handleApply = () => {
    alert(`Applying to ${selectedIds.size} jobs! (Feature coming in Phase 5)`);
    setSelectedIds(new Set());
  };

  const handleClearFilters = () => {
    setFilters({});
    setPagination({ ...pagination, page: 1 });
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Browse Jobs</h1>

        <div className="flex gap-8">
          {/* Filters Sidebar */}
          <div className="w-72 flex-shrink-0">
            <JobFilters
              filters={filters}
              onChange={setFilters}
              filterOptions={filterOptions}
              onClear={handleClearFilters}
            />
          </div>

          {/* Job List */}
          <div className="flex-1">
            <div className="mb-4 text-gray-400 text-sm">
              {pagination.total} jobs found
            </div>

            <JobList
              jobs={jobs}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onViewDetail={setDetailJob}
              loading={loading}
            />

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-white">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Job Detail Modal */}
      {detailJob && <JobDetail job={detailJob} onClose={() => setDetailJob(null)} />}

      {/* Apply Bar */}
      <ApplyBar
        selectedCount={selectedIds.size}
        onApply={handleApply}
        onClear={() => setSelectedIds(new Set())}
      />
    </div>
  );
}

export default Jobs;