import { deriveProfile, sanitizeLocations, sanitizePropertyTypes } from "@/lib/buyer-taxonomy"
import { isEmailAcceptable } from "@/lib/debounce"
import { isLineAcceptable } from "@/lib/number-lookup"

describe("public buyer taxonomy/validation helpers", () => {
  test("deriveProfile unions tags and booleans", () => {
    const out = deriveProfile(["fix_flip"], ["cash"])
    expect(out.tags).toEqual(["Fix and Flips", "Investor", "Fixer Upper", "Cash Buyer"])
    expect(out.investor).toBe(true)
    expect(out.cash_buyer).toBe(true)
  })

  test("email acceptability", () => {
    expect(isEmailAcceptable({ result: "Invalid" }).accept).toBe(false)
    expect(isEmailAcceptable({ result: "Risky" }).tag).toBe("email-risky")
    expect(isEmailAcceptable({ result: "Unknown(api_error)" }).accept).toBe(true)
  })

  test("line acceptability with voip flag", () => {
    process.env.ALLOW_VOIP_SIGNUPS = "false"
    expect(isLineAcceptable({ lineType: "voip" }).accept).toBe(false)
    process.env.ALLOW_VOIP_SIGNUPS = "true"
    expect(isLineAcceptable({ lineType: "voip" }).accept).toBe(true)
    expect(isLineAcceptable({ lineType: "fixed line" }).code).toBe("landline_not_allowed")
  })

  test("sanitize locations and property types", () => {
    expect(sanitizeLocations(["Fulton County (GA)", "Atlanta, GA", "GA, USA"])).toEqual(["Fulton County (GA)", "GA, USA"])
    expect(sanitizePropertyTypes(["Single Family", "Bad Type"])).toEqual(["Single Family"])
  })
})
