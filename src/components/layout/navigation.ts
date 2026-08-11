import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Cpu,
  Database,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Radio,
  Settings,
  Timer,
  Truck,
  Users,
} from "lucide-react"

export type AppRole = "OPERATOR" | "ADMIN"

export interface NavigationItem {
  title: string
  href: string
  icon: LucideIcon
}

export interface NavigationGroup {
  label: string
  items: NavigationItem[]
}

const operatorNavigation: NavigationGroup[] = [
  {
    label: "Operasional",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Antrean Receiving", href: "/receiving-queue", icon: Truck },
      { title: "Sesi Aktif", href: "/active-session", icon: Timer },
      { title: "Aktivitas Sensor", href: "/sensor-activity", icon: Activity },
    ],
  },
]

const adminNavigation: NavigationGroup[] = [
  {
    label: "Operasional",
    items: [
      { title: "Dashboard Admin", href: "/admin/dashboard", icon: LayoutDashboard },
      { title: "Penghitungan", href: "/admin/counting", icon: Timer },
      { title: "Surat Jalan", href: "/admin/receiving", icon: Truck },
      { title: "Aktivitas Sensor", href: "/admin/sensor-activity", icon: Activity },
    ],
  },
  {
    label: "Data & Perangkat",
    items: [
      { title: "Master Data", href: "/admin/master-data", icon: Database },
      { title: "Line & Perangkat", href: "/admin/lines-devices", icon: Cpu },
      { title: "Simulator Sensor", href: "/dev/sensor-simulator", icon: Radio },
    ],
  },
  {
    label: "Administrasi",
    items: [
      { title: "Kelola Pengguna", href: "/admin/users", icon: Users },
      { title: "Pengaturan Sistem", href: "/admin/settings", icon: Settings },
    ],
  },
  {
    label: "Analitik",
    items: [
      { title: "Laporan Operasional", href: "/admin/reports", icon: FileSpreadsheet },
      { title: "Audit Trail", href: "/admin/audit-trail", icon: History },
    ],
  },
]

export function getNavigation(role: AppRole): NavigationGroup[] {
  return role === "ADMIN" ? adminNavigation : operatorNavigation
}

export function isNavigationItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getNavigationTitle(pathname: string, role: AppRole): string {
  const item = getNavigation(role)
    .flatMap((group) => group.items)
    .find((entry) => isNavigationItemActive(pathname, entry.href))

  return item?.title ?? "GSU Pantau"
}
