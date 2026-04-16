import React from "react";

const colorClasses = {
  blue: {
    icon: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    accent: "border-l-blue-500",
  },
  green: {
    icon: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    accent: "border-l-emerald-500",
  },
  purple: {
    icon: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    accent: "border-l-purple-500",
  },
  orange: {
    icon: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    accent: "border-l-orange-500",
  },
};

function StatsCard({ icon: Icon, value, label, color = "blue" }) {
  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div
      className={`
        glass rounded-2xl p-5
        border-l-[3px] ${colors.accent}
        hover:bg-white/[0.05] hover:shadow-card-hover hover:-translate-y-0.5
        transition-all duration-300
      `}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center border ${colors.icon}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
      </div>
    </div>
  );
}

export default StatsCard;
