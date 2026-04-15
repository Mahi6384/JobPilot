import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { User, Briefcase, Target, Zap } from "lucide-react";
import BasicInfoStep from "../components/onboarding/BasicInfoStep";
import CurrentPositionStep from "../components/onboarding/CurrentPositionStep";
import JobPreferencesStep from "../components/onboarding/JobPreferencesStep";
import SkillsResumeStep from "../components/onboarding/SkillsResumeStep";
import Button from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://jobpilot-production-3ba1.up.railway.app");

function Profile() {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeSection, setActiveSection] = useState(1);
  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

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
    try {
      const response = await axios.put(
        `${API_BASE}/api/onboarding/profile`,
        formData,
        { headers: getAuthHeader() },
      );

      setOriginalData(response.data.profile);

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...user,
          fullName: response.data.profile.fullName,
        }),
      );

      window.dispatchEvent(new Event("authChange"));
      toast.success("Profile saved successfully!");
      navigate("/");
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast.error(
        error.response?.data?.message || "Failed to save profile.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    setFormData(originalData);
    setErrors({});
    toast.info("Changes discarded");
  };

  const sections = [
    { number: 1, title: "Basic Info", icon: User },
    { number: 2, title: "Current Position", icon: Briefcase },
    { number: 3, title: "Job Preferences", icon: Target },
    { number: 4, title: "Skills & Resume", icon: Zap },
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
      <div className="flex items-center justify-center p-20">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
      {/* Header with avatar */}
      <div className="flex items-center gap-5 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 text-2xl font-bold">
          {formData.fullName?.charAt(0).toUpperCase() || "U"}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {formData.fullName || "Your Profile"}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {formData.currentJobTitle && formData.currentCompany
              ? `${formData.currentJobTitle} at ${formData.currentCompany}`
              : "Complete your profile to get better matches"}
          </p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-56 flex-shrink-0 hidden md:block">
          <div className="glass rounded-2xl p-3 sticky top-20">
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.number;
                return (
                  <button
                    key={section.number}
                    onClick={() => setActiveSection(section.number)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium
                      transition-all duration-200 relative
                      ${isActive
                        ? "bg-brand-500/10 text-brand-400"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                      }
                    `}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-400 rounded-r-full" />
                    )}
                    <Icon className={`w-4 h-4 ${isActive ? "text-brand-400" : "text-gray-500"}`} />
                    {section.title}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Mobile section selector */}
        <div className="md:hidden flex gap-1 mb-4 p-1 bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-x-auto w-full">
          {sections.map((section) => (
            <button
              key={section.number}
              onClick={() => setActiveSection(section.number)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeSection === section.number
                  ? "bg-brand-500 text-white"
                  : "text-gray-400"
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="glass rounded-2xl p-6 lg:p-8 shadow-glass">
            {renderSection()}

            <div className="flex justify-between mt-8 pt-6 border-t border-white/[0.06]">
              <Button
                variant="ghost"
                onClick={handleDiscard}
                disabled={!hasChanges() || loading}
              >
                Discard Changes
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={loading}
                size="lg"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
