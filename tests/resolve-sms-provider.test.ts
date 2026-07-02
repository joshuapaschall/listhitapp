const h = vi.hoisted(() => ({ getOrgTwilioMock: vi.fn() }))

vi.mock("@/lib/org-twilio/service", () => ({
  getOrgTwilio: h.getOrgTwilioMock,
}))
// Twilio client is only constructed lazily on send; the resolver never calls it.
vi.mock("@/lib/providers/twilio/client", () => ({
  getTwilioClient: () => {
    throw new Error("no network")
  },
}))

import { resolveSmsProvider, TelnyxSmsProvider, TwilioSmsProvider } from "@/lib/providers/sms"

const GWH = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"
const OTHER = "11111111-2222-3333-4444-555555555555"

const liveTwilioRow = {
  sms_provider: "twilio",
  brand_status: "APPROVED",
  messaging_service_sid: "MG123",
  campaign_sid: "CM123",
  phone_number: "+14705550123",
}

describe("resolveSmsProvider", () => {
  const prevPin = process.env.TELNYX_PINNED_ORG_IDS
  const prevEnv = process.env.NODE_ENV

  beforeEach(() => {
    h.getOrgTwilioMock.mockReset()
    process.env.TELNYX_PINNED_ORG_IDS = GWH
    process.env.NODE_ENV = "test"
  })

  afterAll(() => {
    if (prevPin === undefined) delete process.env.TELNYX_PINNED_ORG_IDS
    else process.env.TELNYX_PINNED_ORG_IDS = prevPin
    process.env.NODE_ENV = prevEnv
  })

  test("no orgId → Telnyx (never touches the DB)", async () => {
    const provider = await resolveSmsProvider()
    expect(provider).toBeInstanceOf(TelnyxSmsProvider)
    expect(h.getOrgTwilioMock).not.toHaveBeenCalled()
  })

  test("pinned org (GWH) with a live twilio row → Telnyx (pin wins)", async () => {
    h.getOrgTwilioMock.mockResolvedValue(liveTwilioRow)
    const provider = await resolveSmsProvider(GWH)
    expect(provider).toBeInstanceOf(TelnyxSmsProvider)
  })

  test("non-pinned opted-in + live row → Twilio", async () => {
    h.getOrgTwilioMock.mockResolvedValue(liveTwilioRow)
    const provider = await resolveSmsProvider(OTHER)
    expect(provider).toBeInstanceOf(TwilioSmsProvider)
  })

  test("non-pinned not-live row → Telnyx", async () => {
    h.getOrgTwilioMock.mockResolvedValue({ ...liveTwilioRow, campaign_sid: null })
    const provider = await resolveSmsProvider(OTHER)
    expect(provider).toBeInstanceOf(TelnyxSmsProvider)
  })

  test("non-pinned null row → Telnyx", async () => {
    h.getOrgTwilioMock.mockResolvedValue(null)
    const provider = await resolveSmsProvider(OTHER)
    expect(provider).toBeInstanceOf(TelnyxSmsProvider)
  })

  test("honors assertTelnyxPinConfigured — throws in production when pin is empty", async () => {
    process.env.NODE_ENV = "production"
    process.env.TELNYX_PINNED_ORG_IDS = ""
    await expect(resolveSmsProvider(OTHER)).rejects.toThrow(/TELNYX_PINNED_ORG_IDS/)
  })
})
