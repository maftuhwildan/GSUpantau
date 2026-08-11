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
})
