import React from "react";

function StepIndicator({ currentStep, totalSteps = 4 }) {
  const steps = [
    { number: 1, title: "Basic Info" },
    { number: 2, title: "Current Position" },
    { number: 3, title: "Job Preferences" },
    { number: 4, title: "Skills & Resume" },
  ];

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                  currentStep > step.number
                    ? "bg-green-500 text-white"
                    : currentStep === step.number
                    ? "bg-blue-600 text-white ring-4 ring-blue-600/30"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {currentStep > step.number ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium ${
                  currentStep >= step.number ? "text-white" : "text-gray-500"
                }`}
              >
                {step.title}
              </span>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 rounded transition-all duration-300 ${
                  currentStep > step.number ? "bg-green-500" : "bg-gray-700"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default StepIndicator;
