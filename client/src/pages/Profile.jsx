import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { User, Briefcase, Target, Zap, MapPin, Shield, GraduationCap, BadgeCheck } from "lucide-react";
import BasicInfoStep from "../components/onboarding/BasicInfoStep";
import CurrentPositionStep from "../components/onboarding/CurrentPositionStep";
import JobPreferencesStep from "../components/onboarding/JobPreferencesStep";
import SkillsResumeStep from "../components/onboarding/SkillsResumeStep";
import AddressSocialsSection from "../components/profile/AddressSocialsSection";
import EligibilitySection from "../components/profile/EligibilitySection";
import { ExperienceSection, EducationSection } from "../components/profile/RepeatingEntries";
import EEOSection from "../components/profile/EEOSection";
import Button from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://jobpilot-production-3ba1.up.railway.app");

/** Coerce API payload so validation and inputs see stable array shapes. */
function normalizeProfileFromApi(profile) {
  if (!profile || typeof profile !== "object") return {};
  return {
    ...profile,
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    preferredLocations: Array.isArray(profile.preferredLocations)
      ? profile.preferredLocations
      : [],
    experienceEntries: Array.isArray(profile.experienceEntries)
      ? profile.experienceEntries
      : [],
    educationEntries: Array.isArray(profile.educationEntries)
      ? profile.educationEntries
      : [],
  };
}

function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
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
    if (location.pathname !== "/profile") return;

    let cancelled = false;

    const fetchProfile = async () => {
      setInitialLoading(true);
      try {
        const response = await axios.get(`${API_BASE}/api/onboarding/profile`, {
          headers: getAuthHeader(),
        });
        const raw = response.data.profile;
        const normalized = normalizeProfileFromApi(raw);
        if (!cancelled) {
          setFormData(normalized);
          setOriginalData(normalized);
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        if (error.response?.status === 401) {
          navigate("/login");
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [navigate, location.pathname]);

  // If opened from the extension CTA (`/profile?autofill=1`), jump to the first
  // extended section so users see the extra fields immediately.
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get("autofill") === "1") {
        setActiveSection((s) => (s < 5 ? 5 : s));
      }
    } catch {
      /* ignore */
    }
  }, [location.search]);

  const hasChanges = () => {
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  /** Pure validation for current formData (avoids stale React state when branching). */
  const computeProfileErrors = (data) => {
    const newErrors = {};

    if (!data.fullName?.trim()) newErrors.fullName = "Full name is required";
    if (!data.phone?.trim()) newErrors.phone = "Phone number is required";
    if (!data.location?.trim()) newErrors.location = "Location is required";
    if (!data.currentJobTitle?.trim())
      newErrors.currentJobTitle = "Job title is required";
    if (!data.currentCompany?.trim())
      newErrors.currentCompany = "Company is required";
    if (data.currentLPA === undefined || data.currentLPA === "")
      newErrors.currentLPA = "Current LPA is required";
    if (
      data.yearsOfExperience === undefined ||
      data.yearsOfExperience === ""
    )
      newErrors.yearsOfExperience = "Experience is required";
    if (!data.targetJobTitle?.trim())
      newErrors.targetJobTitle = "Target job is required";
    if (data.expectedLPA === undefined || data.expectedLPA === "")
      newErrors.expectedLPA = "Expected LPA is required";
    if (!data.preferredLocations?.length)
      newErrors.preferredLocations = "Add at least one location";
    if (!data.jobType) newErrors.jobType = "Select a job type";
    if (!data.skills?.length) newErrors.skills = "Add at least one skill";

    return newErrors;
  };

  const validateAll = () => {
    const newErrors = computeProfileErrors(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async ({ navigateAfterSave = true } = {}) => {
    const validationErrors = computeProfileErrors(formData);
    const errorKeys = Object.keys(validationErrors);
    if (errorKeys.length > 0) {
      setErrors(validationErrors);
      if (validationErrors.fullName || validationErrors.phone || validationErrors.location)
        setActiveSection(1);
      else if (
        validationErrors.currentJobTitle ||
        validationErrors.currentCompany ||
        validationErrors.currentLPA ||
        validationErrors.yearsOfExperience
      )
        setActiveSection(2);
      else if (
        validationErrors.targetJobTitle ||
        validationErrors.expectedLPA ||
        validationErrors.preferredLocations ||
        validationErrors.jobType
      )
        setActiveSection(3);
      else if (validationErrors.skills) setActiveSection(4);

      const firstMsg = validationErrors[errorKeys[0]];
      toast.error(
        `Complete required fields in sections 1–4 before saving. ${firstMsg || ""}`,
      );
      return false;
    }

    setLoading(true);
    try {
      const response = await axios.put(
        `${API_BASE}/api/onboarding/profile`,
        formData,
        { headers: getAuthHeader() },
      );

      const saved = normalizeProfileFromApi(response.data.profile);
      setFormData(saved);
      setOriginalData(saved);
      setErrors({});

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
      if (navigateAfterSave) navigate("/");
      return true;
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast.error(
        error.response?.data?.message || "Failed to save profile.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndNext = async () => {
    const ok = await handleSave({ navigateAfterSave: false });
    if (ok) setActiveSection((s) => (s < 9 ? s + 1 : s));
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
    { number: 5, title: "Address & Socials", icon: MapPin },
    { number: 6, title: "Eligibility", icon: Shield },
    { number: 7, title: "Experience", icon: GraduationCap },
    { number: 8, title: "Education", icon: GraduationCap },
    { number: 9, title: "EEO (Optional)", icon: BadgeCheck },
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
      case 5:
        return <AddressSocialsSection formData={formData} setFormData={setFormData} />;
      case 6:
        return <EligibilitySection formData={formData} setFormData={setFormData} />;
      case 7:
        return <ExperienceSection formData={formData} setFormData={setFormData} />;
      case 8:
        return <EducationSection formData={formData} setFormData={setFormData} />;
      case 9:
        return <EEOSection formData={formData} setFormData={setFormData} />;
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

            {Object.keys(errors).length > 0 && (
              <div
                className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90"
                role="alert"
              >
                <p className="font-medium text-amber-100">Fix these before saving</p>
                <ul className="mt-2 list-disc list-inside space-y-1 text-amber-200/85">
                  {Object.entries(errors)
                    .slice(0, 6)
                    .map(([key, msg]) => (
                      <li key={key}>{msg}</li>
                    ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t border-white/[0.06]">
              <Button
                variant="ghost"
                onClick={handleDiscard}
                disabled={!hasChanges() || loading}
              >
                Discard Changes
              </Button>
              <div className="flex gap-2">
                {activeSection >= 5 && activeSection < 9 && (
                  <Button
                    variant="secondary"
                    onClick={() => setActiveSection((s) => (s < 9 ? s + 1 : s))}
                    disabled={loading}
                  >
                    Skip
                  </Button>
                )}
                {activeSection < 9 ? (
                  <Button
                    variant="primary"
                    onClick={handleSaveAndNext}
                    loading={loading}
                    size="lg"
                  >
                    Save & Next
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    loading={loading}
                    size="lg"
                  >
                    Save Changes
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
