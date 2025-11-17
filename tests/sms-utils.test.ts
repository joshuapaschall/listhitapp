import { describe, test, expect } from "@jest/globals"
import { calculateSmsSegments } from "../lib/sms-utils"

describe("calculateSmsSegments", () => {
  test("counts single GSM segment", () => {
    const info = calculateSmsSegments("Hello world")
    expect(info.encoding).toBe("GSM-7")
    expect(info.segments).toBe(1)
    expect(info.remaining).toBe(149)
  })

  test("counts multiple GSM segments", () => {
    const info = calculateSmsSegments("a".repeat(161))
    expect(info.encoding).toBe("GSM-7")
    expect(info.segments).toBe(2)
    expect(info.remaining).toBe(145)
  })

  test("handles unicode encoding", () => {
    const info = calculateSmsSegments("😀".repeat(71))
    expect(info.encoding).toBe("UCS-2")
    expect(info.segments).toBe(2)
    expect(info.remaining).toBe(63)
  })
})
