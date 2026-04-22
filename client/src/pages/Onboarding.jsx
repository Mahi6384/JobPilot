import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Search, Sparkles } from "lucide-react";
import StepIndicator from "../components/onboarding/StepIndicator";
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

function Onboarding() {
  const navigate = useNavigate();
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [findingJobs, setFindingJobs] = useState(false);

  const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchOnboardingStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/onboarding/status`, {
          headers: getAuthHeader(),
        });

        const { profile, onboardingStatus } = response.data;

        if (onboardingStatus === "completed") {
          navigate("/");
          return;
        }

        if (profile) {
          setFormData(profile);
        }

        if (profile.fullName && profile.phone && profile.location) {
          if (profile.currentJobTitle && profile.currentCompany) {
            if (
              profile.targetJobTitle &&
              profile.preferredLocations?.length > 0
            ) {
              setCurrentStep(4);
            } else {
              setCurrentStep(3);
            }
          } else {
            setCurrentStep(2);
          }
        }
      } catch (error) {
        console.error("Failed to fetch onboarding status:", error);
        if (error.response?.status === 401) {
          navigate("/login");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    fetchOnboardingStatus();
  }, [navigate]);

  const validateStep = () => {
    const newErrors = {};

    switch (currentStep) {
      case 1:
        if (!formData.fullName?.trim())
          newErrors.fullName = "Full name is required";
        if (!formData.phone?.trim())
          newErrors.phone = "Phone number is required";
        if (!formData.location?.trim())
          newErrors.location = "Location is required";
        break;
      case 2:
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
        break;
      case 3:
        if (!formData.targetJobTitle?.trim())
          newErrors.targetJobTitle = "Target job is required";
        if (formData.expectedLPA === undefined || formData.expectedLPA === "")
          newErrors.expectedLPA = "Expected LPA is required";
        if (!formData.preferredLocations?.length)
          newErrors.preferredLocations = "Add at least one location";
        if (!formData.jobType) newErrors.jobType = "Select a job type";
        break;
      case 4:
        if (!formData.skills?.length)
          newErrors.skills = "Add at least one skill";
        break;
      case 5:
      case 6:
      case 7:
      case 8:
      case 9:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveStep = async () => {
    setLoading(true);
    try {
      let stepData = {};

      switch (currentStep) {
        case 1:
          stepData = {
            fullName: formData.fullName,
            phone: formData.phone,
            location: formData.location,
          };
          break;
        case 2:
          stepData = {
            currentJobTitle: formData.currentJobTitle,
            currentCompany: formData.currentCompany,
            currentLPA: formData.currentLPA,
            yearsOfExperience: formData.yearsOfExperience,
          };
          break;
        case 3:
          stepData = {
            targetJobTitle: formData.targetJobTitle,
            expectedLPA: formData.expectedLPA,
            preferredLocations: formData.preferredLocations,
            jobType: formData.jobType,
          };
          break;
        case 4:
          stepData = {
            skills: formData.skills,
            linkedinUrl: formData.linkedinUrl,
            resumeUrl: formData.resumeUrl,
            socials: formData.socials,
            experienceEntries: formData.experienceEntries,
            educationEntries: formData.educationEntries,
            currentJobTitle: formData.currentJobTitle,
            currentCompany: formData.currentCompany,
          };
          break;
        case 5:
          stepData = {
            address: formData.address,
            socials: formData.socials,
          };
          break;
        case 6:
          stepData = { workEligibility: formData.workEligibility };
          break;
        case 7:
          stepData = { experienceEntries: formData.experienceEntries };
          break;
        case 8:
          stepData = { educationEntries: formData.educationEntries };
          break;
        case 9:
          stepData = { eeo: formData.eeo };
          break;
      }

      const response = await axios.put(
        `${API_BASE}/api/onboarding/step/${currentStep}`,
        stepData,
        { headers: getAuthHeader() },
      );

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...user,
          onboardingStatus: response.data.user.onboardingStatus,
        }),
      );

      return true;
    } catch (error) {
      console.error("Failed to save step:", error);
      toast.error(
        error.response?.data?.message || "Failed to save. Please try again.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    const saved = await saveStep();
    if (!saved) return;

    if (currentStep < 9) {
      setCurrentStep(currentStep + 1);
      setErrors({});
    } else {
      setFindingJobs(true);
      window.dispatchEvent(new Event("authChange"));
    }
  };

  useEffect(() => {
    if (!findingJobs) return;

    const startTime = Date.now();
    const maxWaitMs = 90000;

    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(
          `${API_BASE}/api/jobs/search-status`,
          { headers: getAuthHeader() },
        );

        if (response.data.jobSearchStatus === "ready") {
          clearInterval(pollInterval);
          navigate("/");
        }
      } catch (error) {
        console.error("Failed to poll search status:", error);
      }

      if (Date.now() - startTime > maxWaitMs) {
        clearInterval(pollInterval);
        navigate("/");
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [findingJobs, navigate]);

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const renderStep = () => {
    switch (currentStep) {
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
        return (
          <AddressSocialsSection
            formData={formData}
            setFormData={setFormData}
          />
        );
      case 6:
        return (
          <EligibilitySection
            formData={formData}
            setFormData={setFormData}
          />
        );
      case 7:
        return (
          <ExperienceSection
            formData={formData}
            setFormData={setFormData}
          />
        );
      case 8:
        return (
          <EducationSection
            formData={formData}
            setFormData={setFormData}
          />
        );
      case 9:
        return (
          <EEOSection
            formData={formData}
            setFormData={setFormData}
          />
        );
      default:
        return null;
    }
  };

  if (findingJobs) {
    return (
      <div className="min-h-screen bg-surface-primary flex items-center justify-center px-4">
        <div className="bg-mesh" />
        <div className="text-center max-w-md animate-fade-in-up relative">
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center animate-pulse-glow">
              <Search className="w-9 h-9 text-brand-400" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Finding Perfect Jobs For You
          </h1>
          <p className="text-gray-400 mb-8 text-lg">
            We're searching for{" "}
            <span className="text-brand-400 font-medium">
              {formData.targetJobTitle}
            </span>{" "}
            roles that match your profile.
          </p>

          <div className="flex justify-center gap-2 mb-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-brand-500"
                style={{
                  animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                  opacity: 0.4,
                }}
              />
            ))}
          </div>

          <p className="text-gray-500 text-sm">
            You'll be redirected automatically when ready
          </p>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 80%, 100% { opacity: 0.4; transform: scale(1); }
            40% { opacity: 1; transform: scale(1.3); }
          }
        `}</style>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary">
        <div className="bg-mesh" />
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading your profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-primary py-8 px-4">
      <div className="bg-mesh" />
      <div className="max-w-2xl mx-auto relative">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Step {currentStep} of 9
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Complete Your Profile
          </h1>
          <p className="text-gray-400">
            This helps us match you with the best opportunities
          </p>
        </div>

        <StepIndicator currentStep={currentStep} />

        {/* Form Card */}
        <div className="glass rounded-2xl p-8 shadow-glass animate-fade-in-up">
          {renderStep()}

          <div className="flex justify-between mt-8 pt-6 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  if (currentStep < 9) {
                    setCurrentStep(currentStep + 1);
                    return;
                  }
                  // Persist step 9 so profile and onboardingStatus save; then continue.
                  const saved = await saveStep();
                  if (!saved) return;
                  setFindingJobs(true);
                  window.dispatchEvent(new Event("authChange"));
                }}
                disabled={loading}
              >
                Skip
              </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleNext}
              loading={loading}
              size="lg"
            >
              {currentStep === 9 ? "Complete Setup" : "Continue"}
            </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
