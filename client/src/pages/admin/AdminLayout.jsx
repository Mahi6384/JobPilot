import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  Activity,
  Settings,
} from "lucide-react";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/jobs", label: "Jobs", icon: Briefcase },
  { to: "/admin/applications", label: "Applications", icon: FileText },
  { to: "/admin/scraper", label: "Scraper", icon: Activity },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface-primary">
      <div className="bg-mesh" />

      <aside
        className={`
          hidden lg:flex flex-col flex-shrink-0
          h-screen sticky top-0
          bg-[#0c0c14] border-r border-white/[0.06]
          transition-all duration-300
          ${collapsed ? "w-16" : "w-60"}
        `}
      >
        <div className="h-16 flex items-center px-4 border-b border-white/[0.06]">
          {!collapsed && (
            <span className="text-sm font-semibold text-white">Admin</span>
          )}
          <button
            className="ml-auto text-gray-500 hover:text-white text-xs"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-brand-500/10 text-brand-400"
                    : "text-gray-400 hover:text-white hover:bg-white/5",
                ].join(" ")
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;

