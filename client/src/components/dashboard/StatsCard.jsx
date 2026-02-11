import React from "react";

function StatsCard({ icon: Icon, value, label, color = "blue" }) {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    green: "bg-green-500/10 text-green-400 border-green-500/30",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:scale-105 transition-transform duration-300 hover:shadow-lg hover:shadow-blue-900/20">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="text-3xl font-bold text-white">{value}</div>
          <div className="text-sm text-gray-400 mt-1">{label}</div>
        </div>
      </div>
    </div>
  );
}

export default StatsCard;