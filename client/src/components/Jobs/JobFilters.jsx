import React from "react";
import { SlidersHorizontal } from "lucide-react";

function JobFilters({ filters, onChange, filterOptions, onClear }) {
  const handleCheckbox = (field, value) => {
    const current = filters[field] || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [field]: updated });
  };

  const inputClass =
    "w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all";

  return (
    <div className="glass rounded-2xl p-5 sticky top-20">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-white">Filters</h3>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-brand-400 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Platform */}
      <FilterSection label="Platform">
        {filterOptions?.platforms?.map((platform) => (
          <CheckboxItem
            key={platform}
            label={platform}
            checked={filters.platform?.includes(platform) || false}
            onChange={() => handleCheckbox("platform", platform)}
          />
        ))}
      </FilterSection>

      {/* Job Type */}
      <FilterSection label="Job Type">
        {filterOptions?.jobTypes?.map((type) => (
          <CheckboxItem
            key={type}
            label={type}
            checked={filters.jobType?.includes(type) || false}
            onChange={() => handleCheckbox("jobType", type)}
          />
        ))}
      </FilterSection>

      {/* Experience */}
      <FilterSection label="Experience (Years)">
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.experienceMin || ""}
            onChange={(e) =>
              onChange({ ...filters, experienceMin: e.target.value })
            }
            className={inputClass}
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.experienceMax || ""}
            onChange={(e) =>
              onChange({ ...filters, experienceMax: e.target.value })
            }
            className={inputClass}
          />
        </div>
      </FilterSection>

      {/* Salary */}
      <FilterSection label="Salary (LPA)">
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.salaryMin || ""}
            onChange={(e) =>
              onChange({ ...filters, salaryMin: e.target.value })
            }
            className={inputClass}
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.salaryMax || ""}
            onChange={(e) =>
              onChange({ ...filters, salaryMax: e.target.value })
            }
            className={inputClass}
          />
        </div>
      </FilterSection>

      {/* Location */}
      <FilterSection label="Location" last>
        <input
          type="text"
          placeholder="Search location..."
          value={filters.location || ""}
          onChange={(e) =>
            onChange({ ...filters, location: e.target.value })
          }
          className={inputClass}
        />
      </FilterSection>
    </div>
  );
}

function FilterSection({ label, last = false, children }) {
  return (
    <div className={`${last ? "" : "mb-5 pb-5 border-b border-white/[0.06]"}`}>
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 block">
        {label}
      </label>
      {children}
    </div>
  );
}

function CheckboxItem({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2.5 mb-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500/30"
      />
      <span className="text-sm text-gray-300 capitalize group-hover:text-white transition-colors">
        {label}
      </span>
    </label>
  );
}

export default JobFilters;
