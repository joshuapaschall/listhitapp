const h = vi.hoisted(() => ({
  loadRoutingStateMock: vi.fn(),
  getTwilioClientForOrgMock: vi.fn(),
  createMock: vi.fn(),
}))

vi.mock("@/lib/providers/routing-state", () => ({
  loadRoutingState: h.loadRoutingStateMock,
}))
vi.mock("@/lib/twilio/org-client", () => ({
  getTwilioClientForOrg: h.getTwilioClientForOrgMock,
}))

import {
  resolveSmsProvider,
  getSmsReadiness,
  SmsNotReadyError,
  TelnyxSmsProvider,
  TwilioSmsProvider,
} from "@/lib/providers/sms"

const GWH = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"
const OTHER = "11111111-2222-3333-4444-555555555555"

const liveTwilioRow = {
  sms_provider: "twilio",
  has_credentials: true,
  subaccount_sid: "AC_sub",
  brand_status: "APPROVED",
  campaign_status: "VERIFIED",
  messaging_service_sid: "MG123",
  campaign_sid: "CM123",
  phone_number: "+14705550123",
}

describe("resolveSmsProvider", () => {
  const prevPin = process.env.TELNYX_PINNED_ORG_IDS
  const prevEnv = process.env.NODE_ENV
  const prevBase = process.env.NEXT_PUBLIC_BASE_URL

  beforeEach(() => {
    h.loadRoutingStateMock.mockReset()
    h.getTwilioClientForOrgMock.mockReset()
    h.createMock.mockReset().mockResolvedValue({ sid: "SM1", from: "+14705550123" })
    h.getTwilioClientForOrgMock.mockResolvedValue({ messages: { create: h.createMock } })
    process.env.TELNYX_PINNED_ORG_IDS = GWH
    process.env.NODE_ENV = "test"
    delete process.env.NEXT_PUBLIC_BASE_URL
  })

  afterAll(() => {
    if (prevPin === undefined) delete process.env.TELNYX_PINNED_ORG_IDS
    else process.env.TELNYX_PINNED_ORG_IDS = prevPin
    process.env.NODE_ENV = prevEnv
    if (prevBase === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
    else process.env.NEXT_PUBLIC_BASE_URL = prevBase
  })

  test("no orgId → throws SmsNotReadyError (never Telnyx, never touches the DB)", async () => {
    await expect(resolveSmsProvider()).rejects.toBeInstanceOf(SmsNotReadyError)
    await expect(resolveSmsProvider(null)).rejects.toMatchObject({ code: "sms_not_ready", status: 409 })
    expect(h.loadRoutingStateMock).not.toHaveBeenCalled()
  })

  test("pinned org (GWH) with a live twilio row → Telnyx (pin wins)", async () => {
    h.loadRoutingStateMock.mockResolvedValue(liveTwilioRow)
    const provider = await resolveSmsProvider(GWH)
    expect(provider).toBeInstanceOf(TelnyxSmsProvider)
    expect(h.getTwilioClientForOrgMock).not.toHaveBeenCalled()
  })

  test("non-pinned live row → Twilio built with the org's own client", async () => {
    h.loadRoutingStateMock.mockResolvedValue(liveTwilioRow)
    const provider = await resolveSmsProvider(OTHER)
    expect(provider).toBeInstanceOf(TwilioSmsProvider)
    expect(h.getTwilioClientForOrgMock).toHaveBeenCalledWith(OTHER)

    await provider.sendMessage({ to: "+15125550123", text: "hi" })
    expect(h.createMock).toHaveBeenCalledWith(expect.objectContaining({ messagingServiceSid: "MG123" }))
  })

  test("non-pinned not-live row → throws SmsNotReadyError (blocked)", async () => {
    h.loadRoutingStateMock.mockResolvedValue({ ...liveTwilioRow, campaign_sid: null })
    await expect(resolveSmsProvider(OTHER)).rejects.toBeInstanceOf(SmsNotReadyError)
    expect(h.getTwilioClientForOrgMock).not.toHaveBeenCalled()
  })

  test("non-pinned null row → throws SmsNotReadyError (blocked)", async () => {
    h.loadRoutingStateMock.mockResolvedValue(null)
    await expect(resolveSmsProvider(OTHER)).rejects.toBeInstanceOf(SmsNotReadyError)
  })

  test("getSmsReadiness never throws: blocked / twilio / telnyx / null org", async () => {
    h.loadRoutingStateMock.mockResolvedValue(null)
    expect(await getSmsReadiness(OTHER)).toBe("blocked")
    expect(await getSmsReadiness(null)).toBe("blocked")
    h.loadRoutingStateMock.mockResolvedValue(liveTwilioRow)
    expect(await getSmsReadiness(OTHER)).toBe("twilio")
    expect(await getSmsReadiness(GWH)).toBe("telnyx")
    h.loadRoutingStateMock.mockRejectedValue(new Error("db down"))
    expect(await getSmsReadiness(OTHER)).toBe("blocked")
  })

  test("honors assertTelnyxPinConfigured — throws in production when pin is empty", async () => {
    process.env.NODE_ENV = "production"
    process.env.TELNYX_PINNED_ORG_IDS = ""
    await expect(resolveSmsProvider(OTHER)).rejects.toThrow(/TELNYX_PINNED_ORG_IDS/)
  })
})
