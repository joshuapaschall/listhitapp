import {
  parseTelnyxPinnedOrgIds,
  isOrgTelnyxPinned,
  isTwilioSmsLive,
  resolveProviderName,
  assertTelnyxPinConfigured,
  type ProviderRoutingRow,
} from "@/lib/providers/sms/routing"

const GWH = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"
const OTHER = "11111111-2222-3333-4444-555555555555"

const liveTwilioRow: ProviderRoutingRow = {
  sms_provider: "twilio",
  brand_status: "APPROVED",
  messaging_service_sid: "MG123",
  campaign_sid: "CM123",
  phone_number: "+14705550123",
}

describe("parseTelnyxPinnedOrgIds", () => {
  test("empty / null / undefined → empty set", () => {
    expect(parseTelnyxPinnedOrgIds("").size).toBe(0)
    expect(parseTelnyxPinnedOrgIds(null).size).toBe(0)
    expect(parseTelnyxPinnedOrgIds(undefined).size).toBe(0)
  })

  test("trims whitespace and drops empties from commas", () => {
    const set = parseTelnyxPinnedOrgIds(`  ${GWH} , ,${OTHER},  `)
    expect(set.has(GWH)).toBe(true)
    expect(set.has(OTHER)).toBe(true)
    expect(set.size).toBe(2)
  })
})

describe("isOrgTelnyxPinned", () => {
  test("true when present, false otherwise", () => {
    const pinned = parseTelnyxPinnedOrgIds(GWH)
    expect(isOrgTelnyxPinned(GWH, pinned)).toBe(true)
    expect(isOrgTelnyxPinned(OTHER, pinned)).toBe(false)
  })
})

describe("isTwilioSmsLive", () => {
  test("true only when brand APPROVED + MS + campaign + number all present", () => {
    expect(isTwilioSmsLive(liveTwilioRow)).toBe(true)
  })

  test("false for null / missing pieces / brand not approved", () => {
    expect(isTwilioSmsLive(null)).toBe(false)
    expect(isTwilioSmsLive(undefined)).toBe(false)
    expect(isTwilioSmsLive({ ...liveTwilioRow, brand_status: "PENDING" })).toBe(false)
    expect(isTwilioSmsLive({ ...liveTwilioRow, messaging_service_sid: null })).toBe(false)
    expect(isTwilioSmsLive({ ...liveTwilioRow, campaign_sid: null })).toBe(false)
    expect(isTwilioSmsLive({ ...liveTwilioRow, phone_number: null })).toBe(false)
  })
})

describe("resolveProviderName", () => {
  const pinned = parseTelnyxPinnedOrgIds(GWH)

  test("pinned org → telnyx even when opted into twilio and rail is live", () => {
    expect(resolveProviderName(GWH, liveTwilioRow, pinned)).toBe("telnyx")
  })

  test("non-pinned, twilio opt-in, rail live → twilio", () => {
    expect(resolveProviderName(OTHER, liveTwilioRow, pinned)).toBe("twilio")
  })

  test("non-pinned, twilio opt-in, rail NOT live → telnyx", () => {
    expect(
      resolveProviderName(OTHER, { ...liveTwilioRow, campaign_sid: null }, pinned),
    ).toBe("telnyx")
    expect(
      resolveProviderName(OTHER, { ...liveTwilioRow, phone_number: null }, pinned),
    ).toBe("telnyx")
    expect(
      resolveProviderName(OTHER, { ...liveTwilioRow, brand_status: "PENDING" }, pinned),
    ).toBe("telnyx")
  })

  test("non-pinned, sms_provider telnyx → telnyx", () => {
    expect(
      resolveProviderName(OTHER, { ...liveTwilioRow, sms_provider: "telnyx" }, pinned),
    ).toBe("telnyx")
  })

  test("null row → telnyx default", () => {
    expect(resolveProviderName(OTHER, null, pinned)).toBe("telnyx")
  })
})

describe("assertTelnyxPinConfigured", () => {
  test("throws in production when the var is empty", () => {
    expect(() =>
      assertTelnyxPinConfigured({ NODE_ENV: "production", TELNYX_PINNED_ORG_IDS: "" } as NodeJS.ProcessEnv),
    ).toThrow(/TELNYX_PINNED_ORG_IDS/)
  })

  test("does not throw in production when the var is set", () => {
    expect(() =>
      assertTelnyxPinConfigured({
        NODE_ENV: "production",
        TELNYX_PINNED_ORG_IDS: GWH,
      } as NodeJS.ProcessEnv),
    ).not.toThrow()
  })

  test("does not throw outside production even when empty", () => {
    expect(() =>
      assertTelnyxPinConfigured({ NODE_ENV: "test", TELNYX_PINNED_ORG_IDS: "" } as NodeJS.ProcessEnv),
    ).not.toThrow()
    expect(() =>
      assertTelnyxPinConfigured({ NODE_ENV: "development" } as NodeJS.ProcessEnv),
    ).not.toThrow()
  })
})
