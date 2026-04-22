import React, { useState } from "react";
import { Link2, X, Upload, Loader2 } from "lucide-react";
import axios from "axios";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { useToast } from "../ui/Toast";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://jobpilot-production-3ba1.up.railway.app");

function SkillsResumeStep({ formData, setFormData, errors }) {
  const [skillInput, setSkillInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const toast = useToast();

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
    "AWS", "Docker", "TypeScript", "MongoDB", "Git", "REST API",
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
      toast.error("Please upload a PDF file");
      return;
    }

    setIsUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append("resume", file);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE}/api/onboarding/parse-resume`,
        formDataUpload,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const {
        skills,
        hasResumeFile,
        structured,
        experienceEntries: expFromApi,
        educationEntries: eduFromApi,
      } = response.data;

      const parsedExp = structured?.experienceEntries?.length
        ? structured.experienceEntries
        : expFromApi;
      const parsedEdu = structured?.educationEntries?.length
        ? structured.educationEntries
        : eduFromApi;

      if (hasResumeFile) {
        toast.success("Resume saved — JobPilot can auto-upload it on Naukri.");
      }

      const isBlankObject = (obj) => {
        if (!obj || typeof obj !== "object") return true;
        return Object.values(obj).every((v) => {
          if (v === null || v === undefined) return true;
          if (typeof v === "string") return v.trim() === "";
          if (typeof v === "number") return Number.isNaN(v);
          if (typeof v === "boolean") return v === false;
          return false;
        });
      };
      const isBlankEntriesArray = (arr) =>
        Array.isArray(arr) && arr.length > 0 && arr.every((e) => isBlankObject(e));
      const isMissingOrBlankArray = (arr) =>
        !Array.isArray(arr) || arr.length === 0 || isBlankEntriesArray(arr);

      // One functional update avoids stale state (skills merge overwriting exp/edu and vice versa).
      setFormData((prev) => {
        const next = { ...prev };

        if (skills && skills.length > 0) {
          const currentSkills = new Set(prev.skills || []);
          skills.forEach((s) => currentSkills.add(s));
          next.skills = Array.from(currentSkills);
        }

        if (isMissingOrBlankArray(prev.experienceEntries) && parsedExp?.length) {
          next.experienceEntries = parsedExp;
        }
        if (isMissingOrBlankArray(prev.educationEntries) && parsedEdu?.length) {
          next.educationEntries = parsedEdu;
        }

        next.socials = { ...(prev.socials || {}) };
        if (!next.socials.githubUrl && structured?.socials?.githubUrl) {
          next.socials.githubUrl = structured.socials.githubUrl;
        }
        if (!next.socials.portfolioUrl && structured?.socials?.portfolioUrl) {
          next.socials.portfolioUrl = structured.socials.portfolioUrl;
        }
        if (!next.socials.twitterUrl && structured?.socials?.twitterUrl) {
          next.socials.twitterUrl = structured.socials.twitterUrl;
        }
        if (!next.linkedinUrl && structured?.socials?.linkedinUrl) {
          next.linkedinUrl = structured.socials.linkedinUrl;
        }

        const primary =
          parsedExp?.find((e) => e?.isCurrent) || parsedExp?.[0];
        if (primary?.title && !String(next.currentJobTitle || "").trim()) {
          next.currentJobTitle = primary.title;
        }
        if (primary?.company && !String(next.currentCompany || "").trim()) {
          next.currentCompany = primary.company;
        }

        return next;
      });

      if (skills && skills.length > 0) {
        toast.success(`Extracted ${skills.length} skills from your resume!`);
      } else {
        toast.info("No common skills found. You can add them manually.");
      }

      if (parsedExp?.length || parsedEdu?.length) {
        toast.success("Added experience/education from resume (edit in Profile).");
      }
    } catch (error) {
      console.error("Resume parsing error:", error);
      toast.error("Failed to parse resume. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">Almost there!</h2>
        <p className="text-sm text-gray-400">Add your skills and resume</p>
      </div>

      {/* Skills input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">Skills</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={handleSkillKeyDown}
            placeholder="Type a skill and press Enter"
            className="flex-1 h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm transition-all duration-200 hover:border-white/20 focus:outline-none focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20"
          />
          <Button type="button" variant="secondary" size="md" onClick={handleAddSkill}>
            Add
          </Button>
        </div>

        {formData.skills?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-sm border border-emerald-500/20"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {errors?.skills && (
          <p className="text-xs text-red-400 animate-fade-in">{errors.skills}</p>
        )}

        {/* Suggested */}
        <div className="mt-3">
          <span className="text-xs text-gray-500 mb-2 block">
            Quick add:
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestedSkills
              .filter((skill) => !formData.skills?.includes(skill))
              .slice(0, 6)
              .map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => handleSuggestedSkillClick(skill)}
                  className="px-3 py-1 bg-white/5 text-gray-400 rounded-full text-sm border border-white/10 hover:border-brand-500/30 hover:text-brand-400 transition-all duration-200"
                >
                  + {skill}
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* LinkedIn URL */}
      <Input
        id="linkedinUrl"
        name="linkedinUrl"
        type="url"
        label="LinkedIn Profile URL (Optional)"
        placeholder="https://linkedin.com/in/your-profile"
        icon={Link2}
        value={formData.linkedinUrl || ""}
        onChange={handleChange}
      />

      {/* Resume Upload */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">
          Auto-fill Skills from Resume
          <span className="text-gray-500 font-normal ml-1">(PDF only)</span>
        </label>
        <div className="relative">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
          />
          <div
            className={`
              w-full px-4 py-8 rounded-xl border-2 border-dashed text-center transition-all duration-200
              ${isUploading
                ? "border-brand-500/50 bg-brand-500/5"
                : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20"
              }
            `}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
                <p className="text-brand-400 text-sm font-medium">
                  Extracting skills from resume...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-500" />
                <p className="text-gray-300 text-sm font-medium">
                  Click or drag PDF to extract skills
                </p>
                <p className="text-gray-500 text-xs">
                  We'll scan for common tech keywords
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SkillsResumeStep;
