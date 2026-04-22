import React from "react";

function ChoicePill({ value, current, onClick, label }) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? "bg-brand-500/15 text-brand-300 border-brand-500/30"
          : "bg-white/5 text-gray-400 border-white/10 hover:border-white/20"
      }`}
    >
      {label}
    </button>
  );
}

export default function EligibilitySection({ formData, setFormData }) {
  const we = formData.workEligibility || {};
  const setWe = (patch) =>
    setFormData((prev) => ({
      ...prev,
      workEligibility: { ...(prev.workEligibility || {}), ...patch },
    }));

  const choices = [
    { v: "Yes", label: "Yes" },
    { v: "No", label: "No" },
    { v: "Prefer not to say", label: "Prefer not to say" },
  ];

  const Row = ({ title, keyName }) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <div className="text-sm text-white font-medium">{title}</div>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <ChoicePill
            key={c.v}
            value={c.v}
            current={we[keyName] || ""}
            onClick={(v) => setWe({ [keyName]: v })}
            label={c.label}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">
          Work eligibility
        </h2>
        <p className="text-sm text-gray-400">
          Common required questions on ATS applications.
        </p>
      </div>

      <div className="space-y-3">
        <Row title="Authorized to work in this country?" keyName="authorizedToWork" />
        <Row title="Do you need sponsorship now or in the future?" keyName="needsSponsorship" />
        <Row title="Willing to relocate if required?" keyName="willingToRelocate" />
      </div>
    </div>
  );
}

