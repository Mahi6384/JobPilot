import React from "react";

function BasicInfoStep({ formData, setFormData, errors }) {
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-6">
      {/* <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Tell us about yourself</h2>
        <p className="text-gray-400">Let's start with your basic information</p>
      </div> */}

      <div className="space-y-4">
        {/* Full Name */}
        <div className="flex flex-col">
          <label htmlFor="fullName" className="text-sm font-medium text-gray-300 mb-2">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={formData.fullName || ""}
            onChange={handleChange}
            placeholder="Enter your full name"
            className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
              errors?.fullName ? "border-red-500" : "border-gray-700"
            } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
          />
          {errors?.fullName && (
            <span className="text-red-500 text-sm mt-1">{errors.fullName}</span>
          )}
        </div>

        {/* Phone */}
        <div className="flex flex-col">
          <label htmlFor="phone" className="text-sm font-medium text-gray-300 mb-2">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone || ""}
            onChange={handleChange}
            placeholder="Enter your phone number"
            className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
              errors?.phone ? "border-red-500" : "border-gray-700"
            } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
          />
          {errors?.phone && (
            <span className="text-red-500 text-sm mt-1">{errors.phone}</span>
          )}
        </div>

        {/* Location */}
        <div className="flex flex-col">
          <label htmlFor="location" className="text-sm font-medium text-gray-300 mb-2">
            Current City <span className="text-red-500">*</span>
          </label>
          <input
            id="location"
            name="location"
            type="text"
            value={formData.location || ""}
            onChange={handleChange}
            placeholder="e.g., Bangalore, Mumbai"
            className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${
              errors?.location ? "border-red-500" : "border-gray-700"
            } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
          />
          {errors?.location && (
            <span className="text-red-500 text-sm mt-1">{errors.location}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default BasicInfoStep;
