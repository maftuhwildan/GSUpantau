import { describe, expect, it } from "vitest"

import {
  getActiveLineChartData,
  getDetectionChartData,
  getRecentReceivingChartData,
} from "@/lib/chart-data"
import {
  appendDateRangeParams,
  formatDateOnly,
  getTodayDateOnly,
  parseDateOnly,
} from "@/lib/ui-date"

describe("date-only UI helpers", () => {
  it("round-trip YYYY-MM-DD tanpa konversi UTC", () => {
    expect(formatDateOnly(parseDateOnly("2026-08-11"))).toBe("2026-08-11")
    expect(parseDateOnly("2026-02-30")).toBeUndefined()
  })

  it("menghasilkan tanggal hari ini dalam timezone site", () => {
    expect(getTodayDateOnly(new Date("2026-08-10T17:30:00Z"))).toBe("2026-08-11")
  })

  it("mempertahankan rentang parsial dan reset", () => {
    expect(appendDateRangeParams(new URLSearchParams(), { from: "2026-08-01" }).toString()).toBe(
      "date_from=2026-08-01"
    )
    expect(
      appendDateRangeParams(new URLSearchParams(), {
        from: "2026-08-01",
        to: "2026-08-11",
      }).toString()
    ).toBe("date_from=2026-08-01&date_to=2026-08-11")
    expect(appendDateRangeParams(new URLSearchParams(), {}).toString()).toBe("")
  })
})

describe("chart data adapters", () => {
  const receivings = Array.from({ length: 15 }, (_, index) => ({
    id: String(index),
    deliveryNoteNumber: `SJ-${index}`,
    receivingDate: "2026-08-11",
    licensePlateSnapshot: `B ${index}`,
    manifestCount: 100 + index,
    actualCount: 99 + index,
  }))

  it("mempertahankan urutan API dan membatasi 12 penerimaan", () => {
    const result = getRecentReceivingChartData(receivings)
    expect(result).toHaveLength(12)
    expect(result[0].label).toBe("SJ-0")
    expect(result[11].label).toBe("SJ-11")
  })

  it("menyediakan dataset nol untuk donut detection", () => {
    expect(getDetectionChartData()).toEqual([
      { key: "assigned", label: "Assigned", value: 0, fill: "var(--color-assigned)" },
      { key: "unassigned", label: "Unassigned", value: 0, fill: "var(--color-unassigned)" },
    ])
  })

  it("hanya memetakan line dengan sesi aktif", () => {
    expect(
      getActiveLineChartData([
        { line: { id: "1", name: "Line 1", lineCode: "L1" }, activeSession: null },
        {
          line: { id: "2", name: "Line 2", lineCode: "L2" },
          activeSession: { actualCount: 92, receiving: { manifestCount: 100 } },
        },
      ])
    ).toEqual([{ id: "2", line: "L2", manifest: 100, actual: 92 }])
  })
})
