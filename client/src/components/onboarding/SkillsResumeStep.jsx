import React, { useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.MODE === 'development' ? "http://localhost:5000" : "https://jobpilot-production-3ba1.up.railway.app");

function SkillsResumeStep({ formData, setFormData, errors }) {
  const [skillInput, setSkillInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills?.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...(formData.skills || []), skillInput.trim()],
      });
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData({
      ...formData,
      skills: formData.skills?.filter((skill) => skill !== skillToRemove),
    });
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const suggestedSkills = [
    "JavaScript", "React", "Node.js", "Python", "Java", "SQL",
    "AWS", "Docker", "TypeScript", "MongoDB", "Git", "REST API"
  ];

  const handleSuggestedSkillClick = (skill) => {
    if (!formData.skills?.includes(skill)) {
      setFormData({
        ...formData,
        skills: [...(formData.skills || []), skill],
      });
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file");
      return;
    }

    setIsUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append("resume", file);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API_BASE}/api/onboarding/parse-resume`, formDataUpload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const { skills } = response.data;
      if (skills && skills.length > 0) {
        // Merge with existing avoiding duplicates
        const currentSkills = new Set(formData.skills || []);
        skills.forEach(s => currentSkills.add(s));
        
        setFormData({
          ...formData,
          skills: Array.from(currentSkills)
        });
        alert(`Successfully extracted ${skills.length} skills from your resume!`);
      } else {
        alert("We couldn't automatically find common skills in your resume. You can add them manually.");
      }
    } catch (error) {
      console.error("Resume parsing error:", error);
      alert("Failed to parse resume. Please try again or add skills manually.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Almost there!</h2>
        <p className="text-gray-400">Add your skills and resume</p>
      </div>

      <div className="space-y-4">
        {/* Skills */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-300 mb-2">
            Skills <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              placeholder="Type a skill and press Enter"
              className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleAddSkill}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
          </div>

          {/* Skill Tags */}
          {formData.skills?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {formData.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {errors?.skills && (
            <span className="text-red-500 text-sm mt-1">{errors.skills}</span>
          )}

          {/* Suggested Skills */}
          <div className="mt-4">
            <span className="text-xs text-gray-500 mb-2 block">Suggested skills:</span>
            <div className="flex flex-wrap gap-2">
              {suggestedSkills
                .filter((skill) => !formData.skills?.includes(skill))
                .slice(0, 6)
                .map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => handleSuggestedSkillClick(skill)}
                    className="px-3 py-1 bg-gray-800 text-gray-400 rounded-full text-sm border border-gray-700 hover:border-blue-500 hover:text-blue-400 transition-colors"
                  >
                    + {skill}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* LinkedIn URL (Optional) */}
        <div className="flex flex-col">
          <label htmlFor="linkedinUrl" className="text-sm font-medium text-gray-300 mb-2">
            LinkedIn Profile URL <span className="text-gray-500">(Optional)</span>
          </label>
          <input
            id="linkedinUrl"
            name="linkedinUrl"
            type="url"
            value={formData.linkedinUrl || ""}
            onChange={handleChange}
            placeholder="https://linkedin.com/in/your-profile"
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        {/* Resume Upload Placeholder */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-300 mb-2">
            Auto-fill Skills from Resume <span className="text-gray-500">(PDF only)</span>
          </label>
          <div className="relative">
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileUpload}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
            />
            <div className={`w-full px-4 py-8 rounded-lg border-2 border-dashed ${isUploading ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-900/50 hover:bg-gray-800'} text-center transition-colors`}>
              {isUploading ? (
                <div className="animate-pulse">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-blue-400 text-sm font-medium">Extracting skills from resume...</p>
                </div>
              ) : (
                <>
                  <svg
                    className="w-10 h-10 mx-auto text-gray-500 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-gray-300 text-sm font-medium">Click or drag PDF to automatically extract skills</p>
                  <p className="text-gray-500 text-xs mt-1">We'll scan for common tech keywords</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SkillsResumeStep;
