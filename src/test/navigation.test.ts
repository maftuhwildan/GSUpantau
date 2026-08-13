import { describe, expect, it } from "vitest"

import {
  getNavigation,
  getNavigationBreadcrumb,
  getNavigationTitle,
  isNavigationItemActive,
} from "@/components/layout/navigation"

describe("navigasi berdasarkan peran", () => {
  it("menyembunyikan seluruh route Admin dari Operator", () => {
    const operatorItems = getNavigation("OPERATOR").flatMap((group) => group.items)

    expect(operatorItems.map((item) => item.href)).toEqual([
      "/dashboard",
      "/receiving-queue",
      "/active-session",
      "/sensor-activity",
    ])
    expect(operatorItems.some((item) => item.href.startsWith("/admin"))).toBe(false)
    expect(operatorItems.some((item) => item.href === "/dev/sensor-simulator")).toBe(false)
  })

  it("mengelompokkan menu Admin tanpa route duplikat", () => {
    const groups = getNavigation("ADMIN")
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.href))

    expect(groups.map((group) => group.label)).toEqual([
      "Operasional",
      "Data & Perangkat",
      "Administrasi",
      "Analitik",
    ])
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(hrefs).toContain("/admin/users")
    expect(hrefs).toContain("/dev/sensor-simulator")
  })

  it("menentukan item aktif dan judul untuk nested route", () => {
    expect(isNavigationItemActive("/admin/receiving/123", "/admin/receiving")).toBe(true)
    expect(isNavigationItemActive("/admin/reports", "/admin/receiving")).toBe(false)
    expect(getNavigationTitle("/admin/audit-trail/123", "ADMIN")).toBe("Audit Trail")
    expect(getNavigationBreadcrumb("/admin/audit-trail/123", "ADMIN")).toEqual({
      groupLabel: "Analitik",
      title: "Audit Trail",
    })
  })
})
