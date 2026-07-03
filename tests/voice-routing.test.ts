import {
  resolveVoiceProviderName,
  isTwilioVoiceLive,
  parseTelnyxPinnedOrgIds,
  type VoiceRoutingRow,
} from "@/lib/providers/voice/routing"

const GWH = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"
const OTHER = "11111111-2222-3333-4444-555555555555"

const liveTwilioRow: VoiceRoutingRow = {
  voice_provider: "twilio",
  phone_number: "+14705550123",
}

describe("isTwilioVoiceLive", () => {
  test("true only when a Twilio number is present (no A2P dependency)", () => {
    expect(isTwilioVoiceLive(liveTwilioRow)).toBe(true)
    expect(isTwilioVoiceLive({ voice_provider: "twilio", phone_number: null })).toBe(false)
    expect(isTwilioVoiceLive(null)).toBe(false)
    expect(isTwilioVoiceLive(undefined)).toBe(false)
  })
})

describe("resolveVoiceProviderName", () => {
  const pinned = parseTelnyxPinnedOrgIds(GWH)

  test("pinned org → telnyx even when opted into twilio and live (pin wins)", () => {
    expect(resolveVoiceProviderName(GWH, liveTwilioRow, pinned)).toBe("telnyx")
  })

  test("non-pinned, twilio opt-in + number → twilio", () => {
    expect(resolveVoiceProviderName(OTHER, liveTwilioRow, pinned)).toBe("twilio")
  })

  test("non-pinned, twilio opt-in but NO number → telnyx", () => {
    expect(
      resolveVoiceProviderName(OTHER, { voice_provider: "twilio", phone_number: null }, pinned),
    ).toBe("telnyx")
  })

  test("non-pinned, voice_provider telnyx → telnyx", () => {
    expect(
      resolveVoiceProviderName(OTHER, { voice_provider: "telnyx", phone_number: "+14705550123" }, pinned),
    ).toBe("telnyx")
  })

  test("null row → telnyx default", () => {
    expect(resolveVoiceProviderName(OTHER, null, pinned)).toBe("telnyx")
  })
})
