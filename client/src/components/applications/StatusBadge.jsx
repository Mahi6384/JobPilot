import React from "react";
import Badge from "../ui/Badge";

const statusConfig = {
  queued: { label: "Queued", color: "warning", dot: true },
  in_progress: { label: "In Progress", color: "info", dot: true },
  applied: { label: "Applied", color: "success", dot: true },
  failed: { label: "Failed", color: "error", dot: true },
  skipped: { label: "Skipped", color: "default", dot: false },
};

function StatusBadge({ status }) {
  const config = statusConfig[status] || {
    label: status,
    color: "default",
    dot: false,
  };

  return (
    <Badge color={config.color} dot={config.dot} size="sm">
      {config.label}
    </Badge>
  );
}

export default StatusBadge;
