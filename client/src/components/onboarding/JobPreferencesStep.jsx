import React, { useState } from "react";

function JobPreferencesStep({ formData, setFormData, errors }) {
  const [locationInput, setLocationInput] = useState("");

  const jobTypes = [
    { value: "full-time", label: "Full-time" },
    {value :"Internship", label:"Internship"},
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
    if (locationInput.trim() && !formData.preferredLocations?.includes(locationInput.trim())) {
      setFormData({
        ...formData,
        preferredLocations: [...(formData.preferredLocations || []), locationInput.trim()],
      });
      setLocationInput("");
    }
  };

  const handleRemoveLocation = (locationToRemove) => {
    setFormData({
      ...formData,
      preferredLocations: formData.preferredLocations?.filter((loc) => loc !== locationToRemove),
    });
  };

  const handleLocationKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddLocation();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">What are you looking for?</h2>
        <p className="text-gray-400">Help us find the perfect job for you</p>
      </div>

      <div className="space-y-4">
        {/* Target Job Title */}
        <div className="flex flex-col">
          <label htmlFor="targetJobTitle" className="text-sm font-medium text-gray-300 mb-2">
            Target Job Title <span className="text-red-500">*</span>
          </label>
          <input
            id="targetJobTitle"
            name="targetJobTitle"
            type="text"
            value={formData.targetJobTitle || ""}
            onChange={handleChange}
            placeholder="e.g., Senior Software Engineer"
            className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
              errors?.targetJobTitle ? "border-red-500" : "border-gray-700"
            } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
          />
          {errors?.targetJobTitle && (
            <span className="text-red-500 text-sm mt-1">{errors.targetJobTitle}</span>
          )}
        </div>

        {/* Expected LPA */}
        <div className="flex flex-col">
          <label htmlFor="expectedLPA" className="text-sm font-medium text-gray-300 mb-2">
            Expected LPA <span className="text-red-500">*</span>
          </label>
          <input
            id="expectedLPA"
            name="expectedLPA"
            type="number"
            min="0"
            step="0.1"
            value={formData.expectedLPA ?? ""}
            onChange={handleChange}
            placeholder="e.g., 18"
            className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
              errors?.expectedLPA ? "border-red-500" : "border-gray-700"
            } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
          />
          {errors?.expectedLPA && (
            <span className="text-red-500 text-sm mt-1">{errors.expectedLPA}</span>
          )}
        </div>

        {/* Preferred Locations */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-300 mb-2">
            Preferred Locations <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={handleLocationKeyDown}
              placeholder="Type a city and press Enter"
              className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleAddLocation}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
          </div>
          {/* Location Tags */}
          {formData.preferredLocations?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {formData.preferredLocations.map((location) => (
                <span
                  key={location}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm"
                >
                  {location}
                  <button
                    type="button"
                    onClick={() => handleRemoveLocation(location)}
                    className="hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {errors?.preferredLocations && (
            <span className="text-red-500 text-sm mt-1">{errors.preferredLocations}</span>
          )}
        </div>

        {/* Job Type */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-300 mb-2">
            Job Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {jobTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData({ ...formData, jobType: type.value })}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  formData.jobType === type.value
                    ? "border-blue-500 bg-blue-500/20 text-blue-400"
                    : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
          {errors?.jobType && (
            <span className="text-red-500 text-sm mt-1">{errors.jobType}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobPreferencesStep;
