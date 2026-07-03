import { buildVoiceIdentity, parseVoiceIdentity } from "@/lib/providers/voice/identity"

const ORG = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"
const USER = "11111111-2222-3333-4444-555555555555"

describe("buildVoiceIdentity", () => {
  test("packs both UUIDs, hyphen-free, alphanumeric+underscore only, ≤121 chars", () => {
    const id = buildVoiceIdentity(ORG, USER)
    expect(id).toMatch(/^[A-Za-z0-9_]+$/)
    expect(id.length).toBeLessThanOrEqual(121)
    expect(id).toBe(`org_${ORG.replace(/-/g, "")}_user_${USER.replace(/-/g, "")}`)
    expect(id).not.toContain("-")
  })

  test("lowercases hex", () => {
    const id = buildVoiceIdentity(ORG.toUpperCase(), USER.toUpperCase())
    expect(id).toBe(id.toLowerCase())
  })

  test("throws on non-UUID input", () => {
    expect(() => buildVoiceIdentity("not-a-uuid", USER)).toThrow()
    expect(() => buildVoiceIdentity(ORG, "12345")).toThrow()
    expect(() => buildVoiceIdentity("", "")).toThrow()
  })
})

describe("parseVoiceIdentity", () => {
  test("round-trips build → parse restoring both UUIDs (lowercased)", () => {
    const id = buildVoiceIdentity(ORG, USER)
    expect(parseVoiceIdentity(id)).toEqual({ orgId: ORG.toLowerCase(), userId: USER.toLowerCase() })
  })

  test("rejects malformed identities", () => {
    expect(parseVoiceIdentity(null)).toBeNull()
    expect(parseVoiceIdentity(undefined)).toBeNull()
    expect(parseVoiceIdentity("")).toBeNull()
    expect(parseVoiceIdentity("garbage")).toBeNull()
    expect(parseVoiceIdentity("org_abc_user_def")).toBeNull() // wrong lengths
    expect(parseVoiceIdentity(`user_${"a".repeat(32)}_org_${"b".repeat(32)}`)).toBeNull() // wrong prefix order
    expect(parseVoiceIdentity(`org_${"z".repeat(32)}_user_${"a".repeat(32)}`)).toBeNull() // illegal hex char
  })
})
