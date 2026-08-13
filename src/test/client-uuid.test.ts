import { describe, expect, it, vi } from "vitest"

import { createClientUuid } from "@/lib/client-uuid"

describe("createClientUuid", () => {
  it("uses crypto.randomUUID when the browser provides it", () => {
    const randomUUID = vi.fn(() => "123e4567-e89b-42d3-a456-426614174000")

    expect(createClientUuid({ randomUUID })).toBe("123e4567-e89b-42d3-a456-426614174000")
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it("creates a valid UUID v4 with getRandomValues as the mobile fallback", () => {
    const uuid = createClientUuid({
      getRandomValues(array) {
        array.fill(0)
        return array
      },
    })

    expect(uuid).toBe("00000000-0000-4000-8000-000000000000")
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
