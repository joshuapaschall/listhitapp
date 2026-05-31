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
    // Each emoji is a UTF-16 surrogate pair (2 UCS-2 units) -> 142 units.
    // ceil(142 / 67) = 3 segments; capacity 3*67=201; remaining 201-142=59.
    expect(info.encoding).toBe("UCS-2")
    expect(info.segments).toBe(3)
    expect(info.remaining).toBe(59)
  })
})
