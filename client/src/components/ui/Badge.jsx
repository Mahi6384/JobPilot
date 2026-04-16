import React from "react";

const colorMap = {
  default: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  brand: "bg-brand-500/10 text-brand-400 border-brand-500/20",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function Badge({
  color = "default",
  dot = false,
  size = "sm",
  children,
  className = "",
}) {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full border
        ${colorMap[color]}
        ${sizeClasses}
        ${className}
      `}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            color === "success"
              ? "bg-emerald-400"
              : color === "error"
                ? "bg-red-400"
                : color === "warning"
                  ? "bg-amber-400"
                  : color === "brand"
                    ? "bg-brand-400"
                    : color === "info"
                      ? "bg-blue-400"
                      : color === "purple"
                        ? "bg-purple-400"
                        : "bg-gray-400"
          }`}
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
