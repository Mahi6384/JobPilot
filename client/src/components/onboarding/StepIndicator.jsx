import React from "react";
import { Check } from "lucide-react";

function StepIndicator({ currentStep }) {
  const steps = [
    { number: 1, title: "Basic Info" },
    { number: 2, title: "Current Position" },
    { number: 3, title: "Job Preferences" },
    { number: 4, title: "Skills & Resume" },
  ];

  return (
    <div className="w-full mb-8 relative">
      <div className="overflow-x-auto overflow-y-hidden pb-4 hide-scrollbar">
        <div className="flex items-center justify-between min-w-max px-4 sm:px-0">
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-semibold text-sm
                    transition-all duration-500 ease-out
                    ${currentStep > step.number
                      ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                      : currentStep === step.number
                        ? "bg-brand-500 text-white ring-4 ring-brand-500/20 shadow-glow"
                        : "bg-white/5 text-gray-500 border border-white/10"
                    }
                  `}
                >
                  {currentStep > step.number ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium transition-colors duration-300 hidden sm:block ${
                    currentStep >= step.number ? "text-white" : "text-gray-500"
                  }`}
                >
                  {step.title}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="flex-1 h-[2px] mx-2 sm:mx-3 min-w-[30px] rounded-full overflow-hidden bg-white/5">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: currentStep > step.number ? "100%" : "0%",
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default StepIndicator;
