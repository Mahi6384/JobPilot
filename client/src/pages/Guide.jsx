import React from "react";
import { Link } from "react-router-dom";
import {
  Rocket,
  FileText,
  CheckCircle,
  Chrome,
  LayoutDashboard,
  Search,
} from "lucide-react";

const Guide = () => {
  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16 px-6 font-montserrat flex flex-col items-center">
      <div className="w-full max-w-4xl mt-12 text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-6">
          Welcome to JobPilot
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          Your ultimate companion for automating job applications and managing
          your career trajectory.
        </p>
      </div>

      <div className="w-full max-w-4xl space-y-12">
        {/* What is JobPilot */}
        {/* <div className="bg-gray-900/50 p-8 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <Rocket className="text-blue-400 w-8 h-8" />
            <h2 className="text-2xl font-semibold text-white">
              What is JobPilot?
            </h2>
          </div>
          <p className="text-gray-300 leading-relaxed text-lg">
            JobPilot is a powerful tool designed to simplify the grueling process of job hunting. Get jobs most related to your requirements and apply on multiple jobs across multiple platforms in one single click.
            <br /><br />
            <strong className="text-emerald-400 font-semibold bg-emerald-400/10 px-3 py-1 rounded-md">No more hours of searching and applying!</strong>
          </p>
        </div> */}

        {/* How to use */}
        <div className="bg-gray-900/50 p-8 rounded-2xl border border-white/5 backdrop-blur-sm">
          <h2 className="text-2xl font-semibold mb-8 text-white flex items-center gap-3">
            <CheckCircle className="text-emerald-400 w-8 h-8" />
            How to use JobPilot
          </h2>

          <div className="space-y-8">
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/50">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  1. Create Profile
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Sign up and complete your onboarding. Set up your preferences,
                  experience, and professional details to get started.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/50">
                <Chrome className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  2. Install Extension
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Install the JobPilot Chrome Extension. Simply log in to the
                  extension once, and you are ready to go!
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/50">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  3. Get Jobs Most Related to Your Requirements
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  We'll fetch and prioritize the job opportunities that most
                  closely align with your unique profile and preferences.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/50">
                <Rocket className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  4. Apply on Multiple Jobs in One Single Click
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Apply on multiple jobs across different platforms seamlessly
                  with a single click. Spend less time applying and more time
                  preparing.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center pb-8">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-8 py-4 rounded-full font-semibold shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 text-lg"
          >
            Get Started Now <Rocket className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Guide;
