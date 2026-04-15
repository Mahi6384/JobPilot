import React from "react";
import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";

const pageTitles = {
  "/": "Dashboard",
  "/jobs": "Jobs",
  "/applications": "Applications",
  "/profile": "Profile",
};

function TopBar({ onMenuClick }) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "JobPilot";

  return (
    <header className="h-16 flex items-center gap-4 px-4 lg:px-6 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-30">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="text-lg font-semibold text-white">{title}</h1>
    </header>
  );
}

export default TopBar;
