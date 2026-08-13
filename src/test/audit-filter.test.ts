import { describe, expect, it } from "vitest"

import {
  canonicalizeAuditEntityType,
  formatAuditActionLabel,
  formatAuditEntityLabel,
  getAuditEntityAliases,
} from "@/lib/audit-filter"

describe("audit filter contract", () => {
  it("normalizes legacy entity values to the current filter value", () => {
    expect(canonicalizeAuditEntityType("USER")).toBe("user")
    expect(canonicalizeAuditEntityType("receiving_session")).toBe("receiving_sessions")
    expect(canonicalizeAuditEntityType("app_settings")).toBe("settings")
  })

  it("queries every stored alias for a canonical entity filter", () => {
    expect(getAuditEntityAliases("user")).toEqual(["user", "USER"])
    expect(getAuditEntityAliases("receiving_sessions")).toContain("receiving_session")
    expect(getAuditEntityAliases("settings")).toContain("app_settings")
  })

  it("presents stored action and entity values using readable labels", () => {
    expect(formatAuditActionLabel("RECEIVING_CREATE")).toBe("Buat Surat Jalan")
    expect(formatAuditActionLabel("SESSION_START")).toBe("Mulai Penghitungan")
    expect(formatAuditEntityLabel("receiving_sessions")).toBe("Sesi Penghitungan")
  })
})
