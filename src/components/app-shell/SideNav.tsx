"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RouteAccess } from "@/lib/auth/route-access";
import { hasRole } from "@/lib/auth/role";
import {
  LayoutDashboard,
  User,
  Settings,
  Folder,
  LogOut,
  ChevronRight,
  Monitor,
  BellRing,
  BriefcaseMedical,
  StickyNote,
  ClipboardMinus,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/button/LogoutButton";
import { useMemo, useState } from "react";
const getIcon = (path: string) => {
  if (path.includes("annotations")) return <StickyNote size={20} />;
  if (path.includes("reception")) return <BellRing size={20} />;
  if (path.includes("encounters")) return <BriefcaseMedical size={20} />;
  if (path.includes("results")) return <ClipboardMinus size={20} />;
  return <Folder size={20} />;
};

const formatLabel = (path: string) => {
  return path
    .replace("/", "")
    .split("/")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export default function SideNav({ session }: any) {
  const role = session?.user?.role;
  const pathname = usePathname();
  const BRAND_COLOR = "#79cbf2";

  const [collapsed, setCollapsed] = useState(false);

  const items = useMemo(() => {
    return RouteAccess.filter((r) => hasRole(role, r.roles)).map(
      (r) => r.prefix
    );
  }, [role]);

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen bg-white border-r border-gray-300 shadow-sm",
        "flex flex-col transition-all duration-200",
        collapsed ? "w-20" : "w-72"
      )}
    >
      {/* Header */}
      <div className={cn("p-4", collapsed ? "px-4" : "px-6")}>
        <div className="flex items-center justify-between gap-2">
          {!collapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                <img
                  src="/images/logo_bcare.svg"
                  alt="BCARE"
                  className="w-8 h-8"
                />
              </div>
              <span className="font-bold text-xl text-success-700 tracking-widest truncate">
                BCARE
              </span>
            </div>
          )}

          {/* Collapse button */}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              "h-12 w-12 rounded-lg flex items-center justify-center",
              "text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition",
              collapsed && "ml-auto"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={24} />
            ) : (
              <PanelLeftClose size={24} />
            )}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 mt-2", collapsed ? "px-2" : "px-4")}>
        {!collapsed && (
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pl-2">
            Menu
          </div>
        )}

        <div className="space-y-2">
          {items.map((p) => {
            const isActive = pathname?.startsWith(p);
            const label = formatLabel(p);

            return (
              <Link
                key={p}
                href={p}
                className={cn(
                  "group relative flex items-center rounded-xl transition-all duration-200",
                  collapsed
                    ? "justify-center px-3 py-3"
                    : "justify-between px-4 py-3",
                  isActive
                    ? "bg-blue-50 text-success-600 font-medium shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <div
                  className={cn(
                    "flex items-center",
                    collapsed ? "gap-0" : "gap-3"
                  )}
                >
                  <span
                    className={cn(
                      "transition-colors shrink-0",
                      isActive
                        ? "text-success-700"
                        : "text-gray-400 group-hover:text-gray-600"
                    )}
                  >
                    {getIcon(p)}
                  </span>

                  {!collapsed && <span className="truncate">{label}</span>}
                </div>

                {!collapsed && isActive && (
                  <ChevronRight size={16} className="text-success-700" />
                )}

                {/* Tooltip khi collapsed */}
                {collapsed && (
                  <span
                    className={cn(
                      "pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2",
                      "whitespace-nowrap rounded-md bg-gray-900 text-white text-xs px-2 py-1",
                      "opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0",
                      "transition-all duration-150"
                    )}
                  >
                    {label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-300">
        <div
          className={cn(
            "flex items-center rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group",
            collapsed ? "justify-center p-3" : "gap-3 p-3"
          )}
        >
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold border-2 border-white shadow-sm shrink-0">
            {session?.user?.username?.[0]?.toUpperCase() ?? "U"}
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {session?.user?.username ?? "Guest User"}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: BRAND_COLOR }}
                  />
                  {role?.toLowerCase() ?? "No Role"}
                </p>
              </div>
              <LogoutButton variant="icon" />
            </>
          )}

          {collapsed && (
            <div className="hidden group-hover:block absolute bottom-16 left-20 rounded-md bg-gray-900 text-white text-xs px-2 py-1">
              Logout
            </div>
          )}

          {collapsed && <LogoutButton variant="icon" />}
        </div>
      </div>
    </aside>
  );
}
