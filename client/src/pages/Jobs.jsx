import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api from "../utils/api";
import { triggerApply, isExtensionConnected } from "../utils/extensionBridge";
import JobFilters from "../components/Jobs/JobFilters";
import JobList from "../components/Jobs/JobList";
import JobDetail from "../components/Jobs/JobDetail";
import ApplyBar from "../components/Jobs/ApplyBar";
import Badge from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";

function Jobs() {
  const navigate = useNavigate();
  const toast = useToast();
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
        toast.success(
          `${queued} job(s) queued — extension is auto-applying`,
        );
      } else {
        toast.info(
          `${queued} job(s) queued — open the extension to start applying`,
        );
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to queue jobs");
    }
  };

  const handleClearFilters = () => {
    setFilters({});
    setPagination({ ...pagination, page: 1 });
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">
          Find Your Next Opportunity
        </h1>
        <p className="text-sm text-gray-400">
          {!loading && (
            <>
              <Badge color="brand" size="sm" className="mr-2">
                {pagination.total}
              </Badge>
              open positions matching your profile
            </>
          )}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Filters sidebar */}
        <div className="w-64 flex-shrink-0 hidden lg:block">
          <JobFilters
            filters={filters}
            onChange={setFilters}
            filterOptions={filterOptions}
            onClear={handleClearFilters}
          />
        </div>

        {/* Job list */}
        <div className="flex-1 min-w-0">
          <JobList
            jobs={jobs}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onViewDetail={setDetailJob}
            loading={loading}
          />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                disabled={pagination.page === 1}
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page - 1 })
                }
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {Array.from({ length: Math.min(pagination.totalPages, 7) }).map(
                (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 4) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 3) {
                    pageNum = pagination.totalPages - 6 + i;
                  } else {
                    pageNum = pagination.page - 3 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() =>
                        setPagination({ ...pagination, page: pageNum })
                      }
                      className={`
                        w-9 h-9 rounded-lg text-sm font-medium transition-all
                        ${pagination.page === pageNum
                          ? "bg-brand-500 text-white shadow-glow"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                        }
                      `}
                    >
                      {pageNum}
                    </button>
                  );
                },
              )}

              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page + 1 })
                }
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Job detail drawer */}
      {detailJob && (
        <JobDetail job={detailJob} onClose={() => setDetailJob(null)} />
      )}

      {/* Apply bar */}
      <ApplyBar
        selectedCount={selectedIds.size}
        onApply={handleApply}
        onClear={() => setSelectedIds(new Set())}
      />
    </div>
  );
}

export default Jobs;
