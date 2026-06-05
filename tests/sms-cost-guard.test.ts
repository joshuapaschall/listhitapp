import { analyzeMessage, optimizeMessage } from "../lib/sms-cost-guard"

describe("sms cost guard", () => {
  test("curly quote flips UCS-2 to GSM-7 and drops a segment", () => {
    // ~89 chars: as UCS-2 that's 2 segments; folded to GSM-7 it's 1.
    const msg =
      "Just listed a “must see” cash deal in your area today. Reply here for the address now"
    const a = analyzeMessage(msg)
    expect(a.before.encoding).toBe("UCS-2")
    expect(a.before.segments).toBe(2)
    expect(a.after.encoding).toBe("GSM-7")
    expect(a.after.segments).toBe(1)
    expect(a.canSave).toBe(true)
  })

  test("pure ASCII has no issues and optimized equals original", () => {
    const msg = "Just listed a cash deal in your area. Reply for the address."
    const a = analyzeMessage(msg)
    expect(a.issues).toHaveLength(0)
    expect(a.optimized).toBe(msg)
    expect(a.canSave).toBe(false)
  })

  test("emoji is kept in optimized, removed in optimizedNoEmoji without altering words", () => {
    const msg = "New cash deal \u{1F525} in Decatur. Reply for the address."
    const a = analyzeMessage(msg)
    expect(a.hasEmoji).toBe(true)
    expect(a.optimized).toContain("\u{1F525}")
    expect(a.optimizedNoEmoji).not.toContain("\u{1F525}")
    // words survive the strip
    expect(a.optimizedNoEmoji).toContain("Decatur")
    expect(a.optimizedNoEmoji).toContain("Reply for the address.")
  })

  test("ellipsis and non-breaking space fold losslessly", () => {
    const msg = "Hurry… last chance"
    expect(optimizeMessage(msg)).toBe("Hurry... last chance")
    const a = analyzeMessage(msg)
    const types = a.issues.map((i) => i.type)
    expect(types).toContain("ellipsis")
    expect(types).toContain("nbsp")
  })

  test("nearBoundary fires on a near-boundary GSM message with no Unicode", () => {
    // 161 plain ASCII chars = 2 GSM segments, only 8 chars in the 2nd segment.
    // Trimming those ~8 drops to 1 segment.
    const msg = "a".repeat(161)
    const a = analyzeMessage(msg)
    expect(a.issues).toHaveLength(0)
    expect(a.nearBoundary).not.toBeNull()
    expect(a.nearBoundary?.trimChars).toBe(8)
  })

  test("nearBoundary is null when Unicode issues exist", () => {
    const msg = "a".repeat(160) + "’"
    const a = analyzeMessage(msg)
    expect(a.issues.length).toBeGreaterThan(0)
    expect(a.nearBoundary).toBeNull()
  })

  test("real dispo message: curly quotes + em-dash → lossless fix halves segments", () => {
    const a = analyzeMessage(
      'Just listed a “must see” cash deal in your area. $185,000. Reply for the address — moving fast!'
    )
    expect(a.before.segments).toBe(2)
    expect(a.before.encoding).toBe("UCS-2")
    expect(a.after.segments).toBe(1)        // after lossless fold (curly→straight, em-dash→hyphen)
    expect(a.after.encoding).toBe("GSM-7")
    expect(a.canSave).toBe(true)
  })

  test("real dispo message: one emoji forces 35/33 capacity → 3 segments", () => {
    const b = analyzeMessage(
      'New cash deal \u{1F525} in Decatur — off-market, must sell fast. Reply for the address.'
    )
    expect(b.before.segments).toBe(3)       // emoji triggers Telnyx's 35/33 limit
    expect(b.hasEmoji).toBe(true)
    expect(b.afterNoEmoji.segments).toBe(1) // removing emoji + folding em-dash → GSM-7, 1 segment
    expect(b.canSave).toBe(true)
  })
})
