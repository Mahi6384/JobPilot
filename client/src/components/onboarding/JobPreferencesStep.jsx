import React, { useState } from "react";
import { Target, IndianRupee, X } from "lucide-react";
import Input from "../ui/Input";
import Button from "../ui/Button";

function JobPreferencesStep({ formData, setFormData, errors }) {
  const [locationInput, setLocationInput] = useState("");

  const jobTypes = [
    { value: "full-time", label: "Full-time" },
    { value: "Internship", label: "Internship" },
    { value: "remote", label: "Remote" },
    { value: "hybrid", label: "Hybrid" },
  ];

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    });
  };

  const handleAddLocation = () => {
    if (
      locationInput.trim() &&
      !formData.preferredLocations?.includes(locationInput.trim())
    ) {
      setFormData({
        ...formData,
        preferredLocations: [
          ...(formData.preferredLocations || []),
          locationInput.trim(),
        ],
      });
      setLocationInput("");
    }
  };

  const handleRemoveLocation = (locationToRemove) => {
    setFormData({
      ...formData,
      preferredLocations: formData.preferredLocations?.filter(
        (loc) => loc !== locationToRemove,
      ),
    });
  };

  const handleLocationKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddLocation();
    }
  };

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">
          What are you looking for?
        </h2>
        <p className="text-sm text-gray-400">
          Help us find the perfect job for you
        </p>
      </div>

      <Input
        id="targetJobTitle"
        name="targetJobTitle"
        type="text"
        label="Target Job Title"
        placeholder="e.g., Senior Software Engineer"
        icon={Target}
        value={formData.targetJobTitle || ""}
        onChange={handleChange}
        error={errors?.targetJobTitle}
      />

      <Input
        id="expectedLPA"
        name="expectedLPA"
        type="number"
        label="Expected LPA"
        placeholder="e.g., 18"
        icon={IndianRupee}
        min="0"
        step="0.1"
        value={formData.expectedLPA ?? ""}
        onChange={handleChange}
        error={errors?.expectedLPA}
      />

      {/* Preferred Locations */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">
          Preferred Locations
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={handleLocationKeyDown}
            placeholder="Type a city and press Enter"
            className="flex-1 h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm transition-all duration-200 hover:border-white/20 focus:outline-none focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20"
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleAddLocation}
          >
            Add
          </Button>
        </div>
        {formData.preferredLocations?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.preferredLocations.map((location) => (
              <span
                key={location}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-500/10 text-brand-400 rounded-full text-sm border border-brand-500/20"
              >
                {location}
                <button
                  type="button"
                  onClick={() => handleRemoveLocation(location)}
                  className="hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {errors?.preferredLocations && (
          <p className="text-xs text-red-400 animate-fade-in">
            {errors.preferredLocations}
          </p>
        )}
      </div>

      {/* Job Type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">Job Type</label>
        <div className="grid grid-cols-2 gap-3">
          {jobTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setFormData({ ...formData, jobType: type.value })}
              className={`
                px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                ${formData.jobType === type.value
                  ? "bg-brand-500/15 border-2 border-brand-500/50 text-brand-400 shadow-glow"
                  : "bg-white/5 border-2 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300"
                }
              `}
            >
              {type.label}
            </button>
          ))}
        </div>
        {errors?.jobType && (
          <p className="text-xs text-red-400 animate-fade-in">
            {errors.jobType}
          </p>
        )}
      </div>
    </div>
  );
}

export default JobPreferencesStep;
