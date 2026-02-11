import React from "react";
import { X } from "lucide-react";

function JobFilters({ filters, onChange, filterOptions, onClear }) {
  const handleCheckbox = (field, value) => {
    const current = filters[field] || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [field]: updated });
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 sticky top-24">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white">Filters</h3>
        <button onClick={onClear} className="text-sm text-gray-400 hover:text-white transition-colors">
          Clear All
        </button>
      </div>

      {/* Platform */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-300 mb-3 block">Platform</label>
        {filterOptions?.platforms?.map((platform) => (
          <label key={platform} className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.platform?.includes(platform) || false}
              onChange={() => handleCheckbox("platform", platform)}
              className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300 capitalize">{platform}</span>
          </label>
        ))}
      </div>

      {/* Job Type */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-300 mb-3 block">Job Type</label>
        {filterOptions?.jobTypes?.map((type) => (
          <label key={type} className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.jobType?.includes(type) || false}
              onChange={() => handleCheckbox("jobType", type)}
              className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300 capitalize">{type}</span>
          </label>
        ))}
      </div>

      {/* Experience Range */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-300 mb-3 block">Experience (Years)</label>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.experienceMin || ""}
            onChange={(e) => onChange({ ...filters, experienceMin: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.experienceMax || ""}
            onChange={(e) => onChange({ ...filters, experienceMax: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500"
          />
        </div>
      </div>

      {/* Salary Range */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-300 mb-3 block">Salary (LPA)</label>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.salaryMin || ""}
            onChange={(e) => onChange({ ...filters, salaryMin: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.salaryMax || ""}
            onChange={(e) => onChange({ ...filters, salaryMax: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="text-sm font-medium text-gray-300 mb-3 block">Location</label>
        <input
          type="text"
          placeholder="Search location..."
          value={filters.location || ""}
          onChange={(e) => onChange({ ...filters, location: e.target.value })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500"
        />
      </div>
    </div>
  );
}

export default JobFilters;