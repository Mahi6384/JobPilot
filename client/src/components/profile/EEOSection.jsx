import React from "react";
import Input from "../ui/Input";

export default function EEOSection({ formData, setFormData }) {
  const eeo = formData.eeo || {};
  const setEeo = (patch) =>
    setFormData((prev) => ({
      ...prev,
      eeo: { ...(prev.eeo || {}), ...patch },
    }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Voluntary disclosures</h2>
        <p className="text-sm text-gray-400">
          Optional. Some ATS steps ask these; we’ll use them if you provide them.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="eeoGender"
          label="Gender"
          value={eeo.gender || ""}
          onChange={(e) => setEeo({ gender: e.target.value })}
        />
        <Input
          id="eeoRace"
          label="Race / Ethnicity"
          value={eeo.raceEthnicity || ""}
          onChange={(e) => setEeo({ raceEthnicity: e.target.value })}
        />
        <Input
          id="eeoVeteran"
          label="Veteran status"
          value={eeo.veteranStatus || ""}
          onChange={(e) => setEeo({ veteranStatus: e.target.value })}
        />
        <Input
          id="eeoDisability"
          label="Disability status"
          value={eeo.disabilityStatus || ""}
          onChange={(e) => setEeo({ disabilityStatus: e.target.value })}
        />
      </div>
    </div>
  );
}

