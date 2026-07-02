const h = vi.hoisted(() => ({ createMock: vi.fn() }))

vi.mock("@/lib/providers/twilio/client", () => ({
  getTwilioClient: () => ({ messages: { create: h.createMock } }),
}))

import { TwilioSmsProvider } from "@/lib/providers/sms/twilio-provider"
import type { SmsProviderError } from "@/lib/providers/sms/types"

const MG = "MG0000000000000000000000000000000000"

describe("TwilioSmsProvider", () => {
  const prevBase = process.env.NEXT_PUBLIC_BASE_URL
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    h.createMock.mockReset()
    h.createMock.mockResolvedValue({ sid: "SM123", from: "+14705550123", status: "queued" })
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io"
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  afterAll(() => {
    if (prevBase === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
    else process.env.NEXT_PUBLIC_BASE_URL = prevBase
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = prevSite
  })

  test("sends via the Messaging Service with a statusCallback and returns { id, from }", async () => {
    const provider = new TwilioSmsProvider({ messagingServiceSid: MG })
    const result = await provider.sendMessage({ to: "+15125550123", text: "hi" })

    expect(h.createMock).toHaveBeenCalledTimes(1)
    const arg = h.createMock.mock.calls[0][0]
    expect(arg.messagingServiceSid).toBe(MG)
    expect(arg.to).toBe("+15125550123")
    expect(arg.body).toBe("hi")
    expect(arg.statusCallback).toBe("https://app.listhit.io/api/webhooks/twilio-status")
    expect("from" in arg).toBe(false)
    expect("mediaUrl" in arg).toBe(false)
    expect(result).toEqual({ id: "SM123", from: "+14705550123" })
  })

  test("includes mediaUrl only when media is present (Twilio's field name)", async () => {
    const provider = new TwilioSmsProvider({ messagingServiceSid: MG })
    await provider.sendMessage({ to: "+15125550123", text: "pic", mediaUrls: ["https://cdn/x.png"] })
    const arg = h.createMock.mock.calls[0][0]
    expect(arg.mediaUrl).toEqual(["https://cdn/x.png"])
    expect("media_urls" in arg).toBe(false)
  })

  test("omits statusCallback when no base URL is configured", async () => {
    delete process.env.NEXT_PUBLIC_BASE_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
    const provider = new TwilioSmsProvider({ messagingServiceSid: MG })
    await provider.sendMessage({ to: "+15125550123", text: "hi" })
    const arg = h.createMock.mock.calls[0][0]
    expect("statusCallback" in arg).toBe(false)
  })

  test("normalizes errors with status and providerCode", async () => {
    h.createMock.mockRejectedValue({ message: "boom", status: 400, code: 21610 })
    const provider = new TwilioSmsProvider({ messagingServiceSid: MG })
    expect.assertions(3)
    try {
      await provider.sendMessage({ to: "+15125550123", text: "hi" })
    } catch (err) {
      const e = err as SmsProviderError
      expect(e.message).toBe("boom")
      expect(e.status).toBe(400)
      expect(e.providerCode).toBe("21610")
    }
  })
})
