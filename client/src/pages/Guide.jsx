import React from "react";
import { Link } from "react-router-dom";
import {
  Rocket,
  FileText,
  Chrome,
  Search,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Button from "../components/ui/Button";

const steps = [
  {
    icon: FileText,
    title: "Create Your Profile",
    description:
      "Sign up and complete your onboarding. Set up your preferences, experience, and professional details to get started.",
  },
  {
    icon: Chrome,
    title: "Install the Extension",
    description:
      "Install the JobPilot Chrome Extension. Simply log in to the extension once, and you're ready to go!",
  },
  {
    icon: Search,
    title: "Get Matched Jobs",
    description:
      "We fetch and prioritize the job opportunities that most closely align with your unique profile and preferences.",
  },
  {
    icon: Rocket,
    title: "Apply in One Click",
    description:
      "Apply to multiple jobs across different platforms seamlessly with a single click. Less time applying, more time preparing.",
  },
];

function Guide() {
  return (
    <div className="min-h-screen bg-surface-primary text-white pb-16 px-6 flex flex-col items-center">
      <div className="bg-mesh" />

      {/* Hero */}
      <div className="w-full max-w-3xl mt-16 text-center mb-20 relative animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Get Started
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
          Welcome to{" "}
          <span className="text-gradient">JobPilot</span>
        </h1>

        <p className="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
          Your ultimate companion for automating job applications and
          accelerating your career.
        </p>
      </div>

      {/* Steps */}
      <div className="w-full max-w-3xl">
        <div className="glass rounded-2xl p-8 lg:p-10 shadow-glass">
          <h2 className="text-xl font-semibold mb-8 text-white flex items-center gap-3">
            How it works
          </h2>

          <div className="space-y-0">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="flex gap-5 relative">
                  {/* Vertical connector line */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-[23px] top-[56px] w-[2px] h-[calc(100%-32px)] bg-white/[0.06]" />
                  )}

                  {/* Number + icon */}
                  <div className="flex-shrink-0 relative">
                    <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`pb-8 ${index === steps.length - 1 ? "pb-0" : ""}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium text-brand-400/60">
                        Step {index + 1}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white mb-1.5">
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center animate-fade-in-up">
          <Link to="/signup">
            <Button variant="gradient" size="lg" iconRight={ArrowRight}>
              Get Started Now
            </Button>
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            Free to use. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Guide;
