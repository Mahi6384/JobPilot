import React from "react";

const statusConfig = {
  queued: { label: "Queued", color: "bg-yellow-500/20 text-yellow-400" },
  in_progress: { label: "In Progress", color: "bg-blue-500/20 text-blue-400" },
  applied: { label: "Applied", color: "bg-green-500/20 text-green-400" },
  failed: { label: "Failed", color: "bg-red-500/20 text-red-400" },
  skipped: { label: "Skipped", color: "bg-gray-500/20 text-gray-400" },
};

function StatusBadge({ status }) {
  const config = statusConfig[status] || {
    label: status,
    color: "bg-gray-500/20 text-gray-400",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}
    >
      {config.label}
    </span>
  );
}

export default StatusBadge;
