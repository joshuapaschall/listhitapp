import {
  resolveVoiceProviderName,
  isTwilioVoiceLive,
  parseTelnyxPinnedOrgIds,
  type VoiceRoutingRow,
} from "@/lib/providers/voice/routing"

const GWH = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"
const OTHER = "11111111-2222-3333-4444-555555555555"

// Live = the org's own subaccount credentials + voice API key + TwiML App + a number.
// Deliberately NO brand/campaign fields: voice has no A2P dependency.
const liveTwilioRow: VoiceRoutingRow = {
  has_credentials: true,
  subaccount_sid: "AC" + "1".repeat(32),
  api_key_sid: "SK" + "1".repeat(32),
  twiml_app_sid: "AP" + "1".repeat(32),
  phone_number: "+14705550123",
}

describe("isTwilioVoiceLive", () => {
  test("true with a number + full subaccount voice credentials (no A2P dependency)", () => {
    expect(isTwilioVoiceLive(liveTwilioRow)).toBe(true)
    expect(isTwilioVoiceLive({ ...liveTwilioRow, phone_number: null })).toBe(false)
    expect(isTwilioVoiceLive(null)).toBe(false)
    expect(isTwilioVoiceLive(undefined)).toBe(false)
  })

  test("false when any credential piece is missing", () => {
    expect(isTwilioVoiceLive({ ...liveTwilioRow, has_credentials: false })).toBe(false)
    expect(isTwilioVoiceLive({ ...liveTwilioRow, subaccount_sid: null })).toBe(false)
    expect(isTwilioVoiceLive({ ...liveTwilioRow, api_key_sid: null })).toBe(false)
    expect(isTwilioVoiceLive({ ...liveTwilioRow, twiml_app_sid: null })).toBe(false)
  })
})

describe("resolveVoiceProviderName", () => {
  const pinned = parseTelnyxPinnedOrgIds(GWH)

  test("pinned org → telnyx even when its Twilio rail is fully live (pin wins)", () => {
    expect(resolveVoiceProviderName(GWH, { ...liveTwilioRow, voice_provider: "twilio" }, pinned)).toBe("telnyx")
  })

  test("non-pinned, number + full credentials → twilio, with no A2P fields needed", () => {
    expect(resolveVoiceProviderName(OTHER, liveTwilioRow, pinned)).toBe("twilio")
  })

  test("non-pinned, live but missing twiml_app_sid → blocked", () => {
    expect(resolveVoiceProviderName(OTHER, { ...liveTwilioRow, twiml_app_sid: null }, pinned)).toBe("blocked")
  })

  test("non-pinned, credentials but NO number → blocked (never telnyx)", () => {
    expect(resolveVoiceProviderName(OTHER, { ...liveTwilioRow, phone_number: null }, pinned)).toBe("blocked")
  })

  test("non-pinned, voice_provider telnyx is ignored → blocked", () => {
    expect(
      resolveVoiceProviderName(OTHER, { voice_provider: "telnyx", phone_number: "+14705550123" }, pinned),
    ).toBe("blocked")
  })

  test("non-pinned, voice_provider telnyx on a live row is ignored → twilio", () => {
    expect(resolveVoiceProviderName(OTHER, { ...liveTwilioRow, voice_provider: "telnyx" }, pinned)).toBe("twilio")
  })

  test("null row → blocked", () => {
    expect(resolveVoiceProviderName(OTHER, null, pinned)).toBe("blocked")
  })
})
