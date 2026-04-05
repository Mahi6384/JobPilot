import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { triggerApply, isExtensionConnected } from "../utils/extensionBridge";
import JobFilters from "../components/Jobs/JobFilters";
import JobList from "../components/Jobs/JobList";
import JobDetail from "../components/Jobs/JobDetail";
import ApplyBar from "../components/Jobs/ApplyBar";

function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [detailJob, setDetailJob] = useState(null);

  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [applyStatus, setApplyStatus] = useState(null);

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

  const handleApply = async () => {
    try {
      const jobIds = [...selectedIds];
      const response = await api.post("/api/applications/batch", { jobIds });
      const queued = response.data?.data?.queued || jobIds.length;

      setSelectedIds(new Set());

      if (isExtensionConnected()) {
        triggerApply();
        setApplyStatus({
          type: "success",
          message: `${queued} job(s) queued — extension is auto-applying`,
        });
      } else {
        setApplyStatus({
          type: "info",
          message: `${queued} job(s) queued — open the JobPilot extension to start applying`,
        });
      }

      setTimeout(() => setApplyStatus(null), 6000);
    } catch (error) {
      const message = error.response?.data?.message || "Failed to queue jobs";
      setApplyStatus({ type: "error", message });
      setTimeout(() => setApplyStatus(null), 6000);
    }
  };

  const handleClearFilters = () => {
    setFilters({});
    setPagination({ ...pagination, page: 1 });
  };

  const statusColors = {
    success: "bg-green-900/50 border-green-700 text-green-300",
    info: "bg-blue-900/50 border-blue-700 text-blue-300",
    error: "bg-red-900/50 border-red-700 text-red-300",
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          Find Your Next Opportunity
        </h1>

        {applyStatus && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg border text-sm font-medium ${statusColors[applyStatus.type]}`}
          >
            {applyStatus.message}
            {applyStatus.type === "success" && (
              <button
                onClick={() => navigate("/applications")}
                className="ml-3 underline text-green-200 hover:text-white"
              >
                View Applications →
              </button>
            )}
          </div>
        )}

        <div className="flex gap-8">
          <div className="w-72 flex-shrink-0">
            <JobFilters
              filters={filters}
              onChange={setFilters}
              filterOptions={filterOptions}
              onClear={handleClearFilters}
            />
          </div>

          <div className="flex-1">
            <div className="mb-4 text-gray-400 text-sm">
              We found {pagination.total} open positions matching your profile
            </div>

            <JobList
              jobs={jobs}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onViewDetail={setDetailJob}
              loading={loading}
            />

            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  disabled={pagination.page === 1}
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page - 1 })
                  }
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-white">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page + 1 })
                  }
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {detailJob && (
        <JobDetail job={detailJob} onClose={() => setDetailJob(null)} />
      )}

      <ApplyBar
        selectedCount={selectedIds.size}
        onApply={handleApply}
        onClear={() => setSelectedIds(new Set())}
      />
    </div>
  );
}

export default Jobs;
