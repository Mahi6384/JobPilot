


import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Onboarding() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    experience: "",
    skills: "",
    preferredRoles: "",
    preferredLocations: "",
    expectedCTC: "",
    resume: null,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    if (e.target.name === "resume") {
      setFormData({ ...formData, resume: e.target.files[0] });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
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
      <div className="max-w-2xl mx-auto text-white">
        <h1 className="text-3xl font-bold mb-6">Complete Your Profile</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-2">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded text-black"
            />
          </div>

          <div>
            <label className="block mb-2">Experience</label>
            <input
              type="text"
              name="experience"
              value={formData.experience}
              onChange={handleChange}
              placeholder="e.g., 3-5 years"
              required
              className="w-full px-4 py-2 rounded text-black"
            />
          </div>

          <div>
            <label className="block mb-2">Skills (comma-separated)</label>
            <input
              type="text"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              placeholder="e.g., JavaScript, React, Node.js"
              required
              className="w-full px-4 py-2 rounded text-black"
            />
          </div>

          <div>
            <label className="block mb-2">Preferred Roles (comma-separated)</label>
            <input
              type="text"
              name="preferredRoles"
              value={formData.preferredRoles}
              onChange={handleChange}
              placeholder="e.g., Software Engineer, Full Stack Developer"
              required
              className="w-full px-4 py-2 rounded text-black"
            />
          </div>

          <div>
            <label className="block mb-2">Preferred Locations (comma-separated)</label>
            <input
              type="text"
              name="preferredLocations"
              value={formData.preferredLocations}
              onChange={handleChange}
              placeholder="e.g., Bangalore, Mumbai, Remote"
              required
              className="w-full px-4 py-2 rounded text-black"
            />
          </div>

          <div>
            <label className="block mb-2">Expected CTC (optional)</label>
            <input
              type="text"
              name="expectedCTC"
              value={formData.expectedCTC}
              onChange={handleChange}
              placeholder="e.g., 10-15 LPA"
              className="w-full px-4 py-2 rounded text-black"
            />
          </div>

          <div>
            <label className="block mb-2">Resume (PDF, DOC, DOCX)</label>
            <input
              type="file"
              name="resume"
              onChange={handleChange}
              accept=".pdf,.doc,.docx"
              className="w-full px-4 py-2 rounded text-black"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold disabled:bg-gray-500"
          >
            {loading ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Onboarding;