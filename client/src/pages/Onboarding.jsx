import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import StepIndicator from "../components/onboarding/StepIndicator";
import BasicInfoStep from "../components/onboarding/BasicInfoStep";
import CurrentPositionStep from "../components/onboarding/CurrentPositionStep";
import JobPreferencesStep from "../components/onboarding/JobPreferencesStep";
import SkillsResumeStep from "../components/onboarding/SkillsResumeStep";

const API_BASE = "http://localhost:5000";

function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Get auth token
  const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  // Fetch existing onboarding data on mount
  useEffect(() => {
    const fetchOnboardingStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/onboarding/status`, {
          headers: getAuthHeader(),
        });

        const { profile, onboardingStatus } = response.data;

        // If already completed, redirect to home
        if (onboardingStatus === "completed") {
          navigate("/");
          return;
        }

        // Populate form with existing data
        if (profile) {
          setFormData(profile);
        }

        // Determine which step to start on
        if (profile.fullName && profile.phone && profile.location) {
          if (profile.currentJobTitle && profile.currentCompany) {
            if (profile.targetJobTitle && profile.preferredLocations?.length > 0) {
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
        // If unauthorized, redirect to login
        if (error.response?.status === 401) {
          navigate("/login");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    fetchOnboardingStatus();
  }, [navigate]);

  // Validate current step
  const validateStep = () => {
    const newErrors = {};

    switch (currentStep) {
      case 1:
        if (!formData.fullName?.trim()) newErrors.fullName = "Full name is required";
        if (!formData.phone?.trim()) newErrors.phone = "Phone number is required";
        if (!formData.location?.trim()) newErrors.location = "Location is required";
        break;
      case 2:
        if (!formData.currentJobTitle?.trim()) newErrors.currentJobTitle = "Job title is required";
        if (!formData.currentCompany?.trim()) newErrors.currentCompany = "Company is required";
        if (formData.currentLPA === undefined || formData.currentLPA === "") 
          newErrors.currentLPA = "Current LPA is required";
        if (formData.yearsOfExperience === undefined || formData.yearsOfExperience === "") 
          newErrors.yearsOfExperience = "Experience is required";
        break;
      case 3:
        if (!formData.targetJobTitle?.trim()) newErrors.targetJobTitle = "Target job is required";
        if (formData.expectedLPA === undefined || formData.expectedLPA === "") 
          newErrors.expectedLPA = "Expected LPA is required";
        if (!formData.preferredLocations?.length) 
          newErrors.preferredLocations = "Add at least one location";
        if (!formData.jobType) newErrors.jobType = "Select a job type";
        break;
      case 4:
        if (!formData.skills?.length) newErrors.skills = "Add at least one skill";
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save current step data
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
          };
          break;
      }

      const response = await axios.put(
        `${API_BASE}/api/onboarding/step/${currentStep}`,
        stepData,
        { headers: getAuthHeader() }
      );

      // Update localStorage with new user data
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({
        ...user,
        onboardingStatus: response.data.user.onboardingStatus,
      }));

      return true;
    } catch (error) {
      console.error("Failed to save step:", error);
      alert(error.response?.data?.message || "Failed to save. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Handle next button
  const handleNext = async () => {
    if (!validateStep()) return;

    const saved = await saveStep();
    if (!saved) return;

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      setErrors({});
    } else {
      // Onboarding complete
      window.dispatchEvent(new Event("authChange"));
      navigate("/");
    }
  };

  // Handle back button
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  // Render current step component
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <BasicInfoStep formData={formData} setFormData={setFormData} errors={errors} />;
      case 2:
        return <CurrentPositionStep formData={formData} setFormData={setFormData} errors={errors} />;
      case 3:
        return <JobPreferencesStep formData={formData} setFormData={setFormData} errors={errors} />;
      case 4:
        return <SkillsResumeStep formData={formData} setFormData={setFormData} errors={errors} />;
      default:
        return null;
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Profile</h1>
          <p className="text-gray-400">
            Step {currentStep} of 4
          </p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Form Card */}
        <div className="bg-gray-900/50 rounded-2xl p-8 shadow-xl border border-gray-800">
          {renderStep()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-800">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                currentStep === 1
                  ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                  : "bg-gray-700 text-white hover:bg-gray-600"
              }`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : currentStep === 4 ? "Complete" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;