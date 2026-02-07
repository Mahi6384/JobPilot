import React from "react";

function CurrentPositionStep({ formData, setFormData, errors }) {
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Your Current Position</h2>
        <p className="text-gray-400">Tell us about your current job</p>
      </div>

      <div className="space-y-4">
        {/* Current Job Title */}
        <div className="flex flex-col">
          <label htmlFor="currentJobTitle" className="text-sm font-medium text-gray-300 mb-2">
            Current Job Title <span className="text-red-500">*</span>
          </label>
          <input
            id="currentJobTitle"
            name="currentJobTitle"
            type="text"
            value={formData.currentJobTitle || ""}
            onChange={handleChange}
            placeholder="e.g., Software Engineer, Product Manager"
            className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
              errors?.currentJobTitle ? "border-red-500" : "border-gray-700"
            } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
          />
          {errors?.currentJobTitle && (
            <span className="text-red-500 text-sm mt-1">{errors.currentJobTitle}</span>
          )}
        </div>

        {/* Current Company */}
        <div className="flex flex-col">
          <label htmlFor="currentCompany" className="text-sm font-medium text-gray-300 mb-2">
            Current Company <span className="text-red-500">*</span>
          </label>
          <input
            id="currentCompany"
            name="currentCompany"
            type="text"
            value={formData.currentCompany || ""}
            onChange={handleChange}
            placeholder="e.g., Google, TCS, Startup"
            className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
              errors?.currentCompany ? "border-red-500" : "border-gray-700"
            } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
          />
          {errors?.currentCompany && (
            <span className="text-red-500 text-sm mt-1">{errors.currentCompany}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Current LPA */}
          <div className="flex flex-col">
            <label htmlFor="currentLPA" className="text-sm font-medium text-gray-300 mb-2">
              Current LPA <span className="text-red-500">*</span>
            </label>
            <input
              id="currentLPA"
              name="currentLPA"
              type="number"
              min="0"
              step="0.1"
              value={formData.currentLPA ?? ""}
              onChange={handleChange}
              placeholder="e.g., 12"
              className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
                errors?.currentLPA ? "border-red-500" : "border-gray-700"
              } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
            />
            {errors?.currentLPA && (
              <span className="text-red-500 text-sm mt-1">{errors.currentLPA}</span>
            )}
          </div>

          {/* Years of Experience */}
          <div className="flex flex-col">
            <label htmlFor="yearsOfExperience" className="text-sm font-medium text-gray-300 mb-2">
              Years of Experience <span className="text-red-500">*</span>
            </label>
            <input
              id="yearsOfExperience"
              name="yearsOfExperience"
              type="number"
              min="0"
              max="50"
              value={formData.yearsOfExperience ?? ""}
              onChange={handleChange}
              placeholder="e.g., 3"
              className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
                errors?.yearsOfExperience ? "border-red-500" : "border-gray-700"
              } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
            />
            {errors?.yearsOfExperience && (
              <span className="text-red-500 text-sm mt-1">{errors.yearsOfExperience}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CurrentPositionStep;
