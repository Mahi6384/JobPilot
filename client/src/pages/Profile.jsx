import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import StepIndicator from "../components/onboarding/StepIndicator";
import BasicInfoStep from "../components/onboarding/BasicInfoStep";
import CurrentPositionStep from "../components/onboarding/CurrentPositionStep";
import JobPreferencesStep from "../components/onboarding/JobPreferencesStep";
import SkillsResumeStep from "../components/onboarding/SkillsResumeStep";

const API_BASE = "http://localhost:5000";

function Profile() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(1);
  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/onboarding/profile`, {
          headers: getAuthHeader(),
        });
        const profile = response.data.profile;
        setFormData(profile);
        setOriginalData(profile);
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        if (error.response?.status === 401) {
          navigate("/login");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const hasChanges = () => {
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  const validateAll = () => {
    const newErrors = {};

    if (!formData.fullName?.trim())
      newErrors.fullName = "Full name is required";
    if (!formData.phone?.trim()) newErrors.phone = "Phone number is required";
    if (!formData.location?.trim()) newErrors.location = "Location is required";

    if (!formData.currentJobTitle?.trim())
      newErrors.currentJobTitle = "Job title is required";
    if (!formData.currentCompany?.trim())
      newErrors.currentCompany = "Company is required";
    if (formData.currentLPA === undefined || formData.currentLPA === "")
      newErrors.currentLPA = "Current LPA is required";
    if (
      formData.yearsOfExperience === undefined ||
      formData.yearsOfExperience === ""
    )
      newErrors.yearsOfExperience = "Experience is required";

    if (!formData.targetJobTitle?.trim())
      newErrors.targetJobTitle = "Target job is required";
    if (formData.expectedLPA === undefined || formData.expectedLPA === "")
      newErrors.expectedLPA = "Expected LPA is required";
    if (!formData.preferredLocations?.length)
      newErrors.preferredLocations = "Add at least one location";
    if (!formData.jobType) newErrors.jobType = "Select a job type";

    if (!formData.skills?.length) newErrors.skills = "Add at least one skill";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateAll()) {
      if (errors.fullName || errors.phone || errors.location)
        setActiveSection(1);
      else if (
        errors.currentJobTitle ||
        errors.currentCompany ||
        errors.currentLPA ||
        errors.yearsOfExperience
      )
        setActiveSection(2);
      else if (
        errors.targetJobTitle ||
        errors.expectedLPA ||
        errors.preferredLocations ||
        errors.jobType
      )
        setActiveSection(3);
      else if (errors.skills) setActiveSection(4);
      return;
    }

    setLoading(true);
    setSaveSuccess(false);
    try {
      const response = await axios.put(
        `${API_BASE}/api/onboarding/profile`,
        formData,
        { headers: getAuthHeader() },
      );

      setOriginalData(response.data.profile);
      setSaveSuccess(true);

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...user,
          fullName: response.data.profile.fullName,
        }),
      );

      window.dispatchEvent(new Event("authChange"));

      navigate("/");
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert(
        error.response?.data?.message ||
          "Failed to save profile. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    setFormData(originalData);
    setErrors({});
  };

  const sections = [
    { number: 1, title: "Basic Info", icon: "👤" },
    { number: 2, title: "Current Position", icon: "💼" },
    { number: 3, title: "Job Preferences", icon: "🎯" },
    { number: 4, title: "Skills & Resume", icon: "⚡" },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 1:
        return (
          <BasicInfoStep
            formData={formData}
            setFormData={setFormData}
            errors={errors}
          />
        );
      case 2:
        return (
          <CurrentPositionStep
            formData={formData}
            setFormData={setFormData}
            errors={errors}
          />
        );
      case 3:
        return (
          <JobPreferencesStep
            formData={formData}
            setFormData={setFormData}
            errors={errors}
          />
        );
      case 4:
        return (
          <SkillsResumeStep
            formData={formData}
            setFormData={setFormData}
            errors={errors}
          />
        );
      default:
        return null;
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-white text-lg">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Edit Profile</h1>
          </div>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-600/20 border border-green-600 rounded-lg text-green-400 text-center">
            ✓ Profile saved successfully!
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 sticky top-24">
              <nav className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.number}
                    onClick={() => setActiveSection(section.number)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeSection === section.number
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <span className="text-lg">{section.icon}</span>
                    <span className="font-medium">{section.title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-gray-900/50 rounded-2xl p-8 shadow-xl border border-gray-800">
              {renderSection()}

              {/* Action Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t border-gray-800">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={!hasChanges() || loading}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    !hasChanges() || loading
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                      : "bg-gray-700 text-white hover:bg-gray-600"
                  }`}
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  //   disabled={!hasChanges() || loading}
                  className={`px-8 py-3 rounded-lg font-medium transition-colors ${"bg-blue-600 text-white hover:bg-blue-700"}`}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
