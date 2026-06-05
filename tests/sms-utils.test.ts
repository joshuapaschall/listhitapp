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

  test("handles unicode encoding with emoji (Telnyx 35/33 rule)", () => {
    const info = calculateSmsSegments("😀".repeat(71))
    // An emoji forces UTF-16 AND triggers Telnyx's hasEmojis limit: single 35,
    // multi 33. charCount is the JS code-unit length (each 😀 is a surrogate
    // pair = 2 units) -> 142. ceil(142 / 33) = 5 segments.
    expect(info.encoding).toBe("UCS-2")
    expect(info.charCount).toBe(142)
    expect(info.charsPerSegment).toBe(33)
    expect(info.segments).toBe(5)
  })

  test("currency with comma stays GSM-7 single segment", () => {
    const info = calculateSmsSegments("$150,000 cash")
    expect(info.encoding).toBe("GSM-7")
    expect(info.segments).toBe(1)
  })

  test("curly quote forces UCS-2", () => {
    const info = calculateSmsSegments("It’s a deal")
    expect(info.encoding).toBe("UCS-2")
  })

  test("euro sign forces UCS-2 (not GSM on Telnyx)", () => {
    const info = calculateSmsSegments("Price €100")
    expect(info.encoding).toBe("UCS-2")
  })

  test("GSM extended char counts as 2", () => {
    const info = calculateSmsSegments("[")
    expect(info.encoding).toBe("GSM-7")
    expect(info.charCount).toBe(2)
  })
})
