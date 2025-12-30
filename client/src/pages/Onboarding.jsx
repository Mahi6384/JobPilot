


import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Onboarding() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    currentCity: "",
    remotePreference: false,
    experience: "",
    skills: "",
    preferredRoles: "",
    jobType: "Full-time",
    workMode: "Onsite",
    expectedCTC: "",
    resume: null,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (name === "resume") {
      setFormData({ ...formData, resume: files[0] });
    } else if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const formDataToSend = new FormData();
      
      Object.keys(formData).forEach((key) => {
        if (key !== "resume") {
          formDataToSend.append(key, formData[key]);
        }
      });

      if (formData.resume) {
        formDataToSend.append("resume", formData.resume);
      }

      await axios.post("http://localhost:5000/api/profile", formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      navigate("/connect-naukri");
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-3xl mx-auto text-white">
        <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Complete Your Profile
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-8 bg-gray-900/50 p-8 rounded-2xl border border-gray-800 backdrop-blur-sm">
          {/* Basic Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-gray-800 pb-2 text-blue-400">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm text-gray-400">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="John Doe"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm text-gray-400">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 9876543210"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm text-gray-400">Current City</label>
                <input
                  type="text"
                  name="currentCity"
                  value={formData.currentCity}
                  onChange={handleChange}
                  placeholder="e.g. Bangalore"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                />
              </div>
              <div className="flex items-center pt-8">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="remotePreference"
                    checked={formData.remotePreference}
                    onChange={handleChange}
                    className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-400">Open to Remote work</span>
                </label>
              </div>
            </div>
          </section>

          {/* Career Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-gray-800 pb-2 text-purple-400">Career</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block mb-2 text-sm text-gray-400">Job Role(s) (comma-separated)</label>
                <input
                  type="text"
                  name="preferredRoles"
                  value={formData.preferredRoles}
                  onChange={handleChange}
                  placeholder="e.g. Frontend, Backend, GenAI"
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm text-gray-400">Experience (years)</label>
                <input
                  type="text"
                  name="experience"
                  value={formData.experience}
                  onChange={handleChange}
                  placeholder="e.g. 3 years"
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm text-gray-400">Skills (comma-separated)</label>
                <input
                  type="text"
                  name="skills"
                  value={formData.skills}
                  onChange={handleChange}
                  placeholder="e.g. React, Node.js, Python"
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block mb-2 text-sm text-gray-400">Resume (PDF, DOC, DOCX)</label>
                <input
                  type="file"
                  name="resume"
                  onChange={handleChange}
                  accept=".pdf,.doc,.docx"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600 text-gray-400"
                />
              </div>
            </div>
          </section>

          {/* Preferences Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-gray-800 pb-2 text-green-400">Preferences</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm text-gray-400">Job Type</label>
                <select
                  name="jobType"
                  value={formData.jobType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 text-sm text-gray-400">Work Mode</label>
                <select
                  name="workMode"
                  value={formData.workMode}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white"
                >
                  <option value="Onsite">Onsite</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 text-sm text-gray-400">Minimum Salary (optional)</label>
                <input
                  type="text"
                  name="expectedCTC"
                  value={formData.expectedCTC}
                  onChange={handleChange}
                  placeholder="e.g. 10 LPA"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white"
                />
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
          >
            {loading ? "Saving Your Profile..." : "Save Profile & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Onboarding;