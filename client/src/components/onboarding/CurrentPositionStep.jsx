import React from "react";
import { Briefcase, Building2, IndianRupee, Clock } from "lucide-react";
import Input from "../ui/Input";

function CurrentPositionStep({ formData, setFormData, errors }) {
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    });
  };

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">Your Current Position</h2>
        <p className="text-sm text-gray-400">Tell us about your current job</p>
      </div>

      <Input
        id="currentJobTitle"
        name="currentJobTitle"
        type="text"
        label="Current Job Title"
        placeholder="e.g., Software Engineer, Product Manager"
        icon={Briefcase}
        value={formData.currentJobTitle || ""}
        onChange={handleChange}
        error={errors?.currentJobTitle}
      />

      <Input
        id="currentCompany"
        name="currentCompany"
        type="text"
        label="Current Company"
        placeholder="e.g., Google, TCS, Startup"
        icon={Building2}
        value={formData.currentCompany || ""}
        onChange={handleChange}
        error={errors?.currentCompany}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="currentLPA"
          name="currentLPA"
          type="number"
          label="Current LPA"
          placeholder="e.g., 12"
          icon={IndianRupee}
          min="0"
          step="0.1"
          value={formData.currentLPA ?? ""}
          onChange={handleChange}
          error={errors?.currentLPA}
        />

        <Input
          id="yearsOfExperience"
          name="yearsOfExperience"
          type="number"
          label="Years of Experience"
          placeholder="e.g., 3"
          icon={Clock}
          min="0"
          max="50"
          value={formData.yearsOfExperience ?? ""}
          onChange={handleChange}
          error={errors?.yearsOfExperience}
        />
      </div>
    </div>
  );
}

export default CurrentPositionStep;
