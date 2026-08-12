import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const SOURCE_ROOTS = [path.resolve("src/app"), path.resolve("src/components")]
const GENERATED_UI_ROOT = path.resolve("src/components/ui")

function collectApplicationSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (target === GENERATED_UI_ROOT) return []
      return collectApplicationSources(target)
    }
    return /\.(tsx|ts)$/.test(entry.name) ? [target] : []
  })
}

const applicationSources = SOURCE_ROOTS.flatMap(collectApplicationSources)

describe("konvensi UI shadcn dan semantic tokens", () => {
  it("tidak memakai utility palette langsung di kode aplikasi", () => {
    const palettePattern = /(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-[0-9]{2,3})?(?:\/[0-9]{1,3})?/g
    const violations = applicationSources.flatMap((file) => {
      const matches = readFileSync(file, "utf8").match(palettePattern) ?? []
      return matches.map((match) => `${path.relative(process.cwd(), file)}: ${match}`)
    })

    expect(violations).toEqual([])
  })

  it("tidak membuat ulang primitive form, tabel, atau date input secara native", () => {
    const nativePattern = /<(?:button|input|select|textarea|table|label)\b|type=["']date["']/g
    const violations = applicationSources.flatMap((file) => {
      const matches = readFileSync(file, "utf8").match(nativePattern) ?? []
      return matches.map((match) => `${path.relative(process.cwd(), file)}: ${match}`)
    })

    expect(violations).toEqual([])
  })

  it("tidak memakai typography dengan bobot berlebihan", () => {
    const heavyTypographyPattern = /\bfont-(?:bold|extrabold|black)\b/g
    const violations = applicationSources.flatMap((file) => {
      const matches = readFileSync(file, "utf8").match(heavyTypographyPattern) ?? []
      return matches.map((match) => `${path.relative(process.cwd(), file)}: ${match}`)
    })

    expect(violations).toEqual([])
  })

  it("tidak memakai arbitrary text sizes (text-[...]) di kode aplikasi", () => {
    const arbitraryTextSizePattern = /\btext-\[[^\]]+\]/g
    const violations = applicationSources.flatMap((file) => {
      const matches = readFileSync(file, "utf8").match(arbitraryTextSizePattern) ?? []
      return matches.map((match) => `${path.relative(process.cwd(), file)}: ${match}`)
    })

    expect(violations).toEqual([])
  })

  it("membatasi Alert ke variant resmi default dan destructive", () => {
    const nonstandardAlertPattern = /<Alert\b[^>]*\bvariant=["'](?:success|warning|info)["']/g
    const violations = applicationSources.flatMap((file) => {
      const matches = readFileSync(file, "utf8").match(nonstandardAlertPattern) ?? []
      return matches.map((match) => `${path.relative(process.cwd(), file)}: ${match}`)
    })

    expect(violations).toEqual([])
  })

  it("memakai palette chart shadcn, bukan token metric lama", () => {
    const legacyChartPattern = /var\(--metric-(?:manifest|actual|assigned|unassigned)\)/g
    const violations = applicationSources.flatMap((file) => {
      const matches = readFileSync(file, "utf8").match(legacyChartPattern) ?? []
      return matches.map((match) => `${path.relative(process.cwd(), file)}: ${match}`)
    })

    expect(violations).toEqual([])
  })

  it("mempertahankan form Surat Jalan yang terstruktur dan field urutan dokumen", () => {
    const formSource = readFileSync(
      path.resolve("src/components/receiving/receiving-form-dialog.tsx"),
      "utf8"
    )

    expect(formSource).toContain("Collapsible")
    expect(formSource).toContain("Isi dari data master")
    expect(formSource).toContain('id="document-truck-sequence"')
    expect(formSource).toContain("documentTruckSequence")
  })

  it("memastikan tabel antrean Surat Jalan tidak menggunakan font-semibold atau font-mono pada data utama", () => {
    const tableSource = readFileSync(
      path.resolve("src/components/receiving/queue-table.tsx"),
      "utf8"
    )

    expect(tableSource).not.toMatch(/TableCell[^>]*font-semibold/)
    expect(tableSource).not.toMatch(/r\.deliveryNoteNumber[^}]*font-mono/)
    expect(tableSource).not.toMatch(/r\.receivingNumber[^}]*font-mono/)
    expect(tableSource).toContain("font-normal tabular-nums")
  })
})
