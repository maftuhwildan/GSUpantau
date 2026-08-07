"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Timer,
  Activity,
  Database,
  Cpu,
  Users,
  Settings,
  FileSpreadsheet,
  History,
  Bird,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  role: "OPERATOR" | "ADMIN";
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const operatorNavItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Antrean Receiving",
      href: "/receiving-queue",
      icon: Truck,
    },
    {
      title: "Sesi Aktif",
      href: "/active-session",
      icon: Timer,
    },
    {
      title: "Aktivitas Sensor",
      href: "/sensor-activity",
      icon: Activity,
    },
  ];

  const adminNavItems = [
    {
      title: "Dashboard Admin",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Penghitungan (Counting)",
      href: "/admin/counting",
      icon: Timer,
    },
    {
      title: "Surat Jalan (Receiving)",
      href: "/admin/receiving",
      icon: Truck,
    },
    {
      title: "Aktivitas Sensor",
      href: "/admin/sensor-activity",
      icon: Activity,
    },
    {
      title: "Master Data",
      href: "/admin/master-data",
      icon: Database,
    },
    {
      title: "Line & Perangkat",
      href: "/admin/lines-devices",
      icon: Cpu,
    },
    {
      title: "Kelola Pengguna",
      href: "/admin/users",
      icon: Users,
    },
    {
      title: "Pengaturan Sistem",
      href: "/admin/settings",
      icon: Settings,
    },
    {
      title: "Laporan Ops",
      href: "/admin/reports",
      icon: FileSpreadsheet,
    },
    {
      title: "Audit Trail",
      href: "/admin/audit-trail",
      icon: History,
    },
  ];

  const navItems = role === "ADMIN" ? adminNavItems : operatorNavItems;

  return (
    <aside className="w-64 shrink-0 bg-sidebar-gradient text-white flex flex-col min-h-screen border-r border-purple-900/40 shadow-xl">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-white/10">
        <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
          <Bird className="h-6 w-6 text-pink-300" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide text-white leading-tight">
            GSU Pantau
          </h1>
          <p className="text-[10px] text-pink-200/80 font-medium">
            Poultry Counter RPA
          </p>
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-6 py-3 border-b border-white/5 bg-black/10 flex items-center justify-between">
        <span className="text-xs text-purple-200/70 font-medium">Peran Aktif</span>
        <span
          className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
            role === "ADMIN"
              ? "bg-purple-500/30 text-purple-200 border border-purple-400/30"
              : "bg-emerald-500/30 text-emerald-200 border border-emerald-400/30"
          )}
        >
          {role}
        </span>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150",
                isActive
                  ? "bg-white/20 text-white font-semibold shadow-inner border border-white/20"
                  : "text-purple-100/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-pink-300" : "text-purple-300/70")} />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-white/10 bg-black/20 text-[10px] text-purple-200/60 text-center">
        Poultry Counter MVP v1.0
      </div>
    </aside>
  );
}
