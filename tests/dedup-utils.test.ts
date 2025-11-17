import { describe, test, expect } from "@jest/globals"
import { formatPhoneE164 } from "../lib/dedup-utils"

describe("formatPhoneE164", () => {
  test("handles numeric input", () => {
    expect(formatPhoneE164(1234567890)).toBe("+11234567890")
  })
})
