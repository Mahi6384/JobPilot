import React from "react";
import Input from "../ui/Input";

function IconButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 rounded-xl bg-white/5 text-gray-300 border border-white/10 hover:border-white/20 transition-all text-sm"
    >
      {children}
    </button>
  );
}

export function ExperienceSection({ formData, setFormData }) {
  const entries = Array.isArray(formData.experienceEntries)
    ? formData.experienceEntries
    : [];

  const setEntries = (next) =>
    setFormData((prev) => ({
      ...prev,
      experienceEntries:
        typeof next === "function"
          ? next(Array.isArray(prev.experienceEntries) ? prev.experienceEntries : [])
          : next,
    }));

  const add = () =>
    setEntries((list) => [
      ...list,
      {
        company: "",
        title: "",
        location: "",
        startMonth: "",
        startYear: "",
        endMonth: "",
        endYear: "",
        isCurrent: false,
        description: "",
      },
    ]);

  const remove = (idx) => setEntries((list) => list.filter((_, i) => i !== idx));

  const update = (idx, patch) =>
    setEntries((list) =>
      list.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            Work experience
          </h2>
          <p className="text-sm text-gray-400">
            Helps Workday autofill “My Experience” sections.
          </p>
        </div>
        <IconButton onClick={add}>Add experience</IconButton>
      </div>

      {entries.length === 0 ? (
        <div className="text-sm text-gray-400 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          No entries yet. Add at least one for best Workday automation.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((e, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="text-sm font-semibold text-white">
                  Experience #{idx + 1}
                </div>
                <IconButton onClick={() => remove(idx)}>Remove</IconButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Company"
                  value={e.company || ""}
                  onChange={(ev) => update(idx, { company: ev.target.value })}
                />
                <Input
                  label="Title"
                  value={e.title || ""}
                  onChange={(ev) => update(idx, { title: ev.target.value })}
                />
                <Input
                  label="Location (optional)"
                  value={e.location || ""}
                  onChange={(ev) => update(idx, { location: ev.target.value })}
                />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-300">
                    Current role
                  </label>
                  <input
                    type="checkbox"
                    checked={Boolean(e.isCurrent)}
                    onChange={(ev) => update(idx, { isCurrent: ev.target.checked })}
                  />
                </div>
                <Input
                  label="Start month"
                  value={e.startMonth || ""}
                  onChange={(ev) => update(idx, { startMonth: ev.target.value })}
                />
                <Input
                  label="Start year"
                  value={e.startYear || ""}
                  onChange={(ev) => update(idx, { startYear: ev.target.value })}
                />
                <Input
                  label="End month"
                  value={e.endMonth || ""}
                  onChange={(ev) => update(idx, { endMonth: ev.target.value })}
                  disabled={Boolean(e.isCurrent)}
                />
                <Input
                  label="End year"
                  value={e.endYear || ""}
                  onChange={(ev) => update(idx, { endYear: ev.target.value })}
                  disabled={Boolean(e.isCurrent)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300">
                  Description (optional)
                </label>
                <textarea
                  value={e.description || ""}
                  onChange={(ev) => update(idx, { description: ev.target.value })}
                  className="mt-2 w-full min-h-[90px] rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm px-4 py-3"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EducationSection({ formData, setFormData }) {
  const entries = Array.isArray(formData.educationEntries)
    ? formData.educationEntries
    : [];

  const setEntries = (next) =>
    setFormData((prev) => ({
      ...prev,
      educationEntries:
        typeof next === "function"
          ? next(Array.isArray(prev.educationEntries) ? prev.educationEntries : [])
          : next,
    }));

  const add = () =>
    setEntries((list) => [
      ...list,
      {
        school: "",
        degree: "",
        fieldOfStudy: "",
        startMonth: "",
        startYear: "",
        endMonth: "",
        endYear: "",
        gpa: "",
      },
    ]);

  const remove = (idx) => setEntries((list) => list.filter((_, i) => i !== idx));

  const update = (idx, patch) =>
    setEntries((list) =>
      list.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Education</h2>
          <p className="text-sm text-gray-400">
            Improves Workday education autofill.
          </p>
        </div>
        <IconButton onClick={add}>Add education</IconButton>
      </div>

      {entries.length === 0 ? (
        <div className="text-sm text-gray-400 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          No entries yet.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((e, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="text-sm font-semibold text-white">
                  Education #{idx + 1}
                </div>
                <IconButton onClick={() => remove(idx)}>Remove</IconButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="School"
                  value={e.school || ""}
                  onChange={(ev) => update(idx, { school: ev.target.value })}
                />
                <Input
                  label="Degree"
                  value={e.degree || ""}
                  onChange={(ev) => update(idx, { degree: ev.target.value })}
                />
                <Input
                  label="Field of study"
                  value={e.fieldOfStudy || ""}
                  onChange={(ev) => update(idx, { fieldOfStudy: ev.target.value })}
                />
                <Input
                  label="GPA (optional)"
                  value={e.gpa || ""}
                  onChange={(ev) => update(idx, { gpa: ev.target.value })}
                />
                <Input
                  label="Start month"
                  value={e.startMonth || ""}
                  onChange={(ev) => update(idx, { startMonth: ev.target.value })}
                />
                <Input
                  label="Start year"
                  value={e.startYear || ""}
                  onChange={(ev) => update(idx, { startYear: ev.target.value })}
                />
                <Input
                  label="End month"
                  value={e.endMonth || ""}
                  onChange={(ev) => update(idx, { endMonth: ev.target.value })}
                />
                <Input
                  label="End year"
                  value={e.endYear || ""}
                  onChange={(ev) => update(idx, { endYear: ev.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

