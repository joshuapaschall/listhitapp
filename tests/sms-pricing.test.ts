import { describe, expect, test } from "vitest"
import { estimateCampaignCost, formatUsd } from "@/lib/sms-pricing"

describe("estimateCampaignCost", () => {
  test("SMS is billed per segment: rate.sms × segments × recipients", () => {
    const c = estimateCampaignCost({ recipients: 100, segments: 3, hasMedia: false, provider: "telnyx" })
    expect(c.rateLabel).toBe("SMS")
    expect(c.perRecipient).toBeCloseTo(0.008 * 3, 6) // 0.024
    expect(c.total).toBeCloseTo(0.008 * 3 * 100, 6) // 2.4
    expect(c.estimated).toBe(true)
  })

  test("MMS is billed per message, NOT × segments", () => {
    const c = estimateCampaignCost({ recipients: 100, segments: 3, hasMedia: true, provider: "telnyx" })
    expect(c.rateLabel).toBe("MMS")
    expect(c.perRecipient).toBeCloseTo(0.024, 6) // flat per message
    expect(c.perRecipient).not.toBeCloseTo(0.024 * 3, 6) // must not multiply by segments
    expect(c.total).toBeCloseTo(0.024 * 100, 6) // 2.4
  })

  test("telnyx vs twilio pick different rates", () => {
    const telnyx = estimateCampaignCost({ recipients: 10, segments: 1, hasMedia: false, provider: "telnyx" })
    const twilio = estimateCampaignCost({ recipients: 10, segments: 1, hasMedia: false, provider: "twilio" })
    expect(telnyx.perRecipient).toBeCloseTo(0.008, 6)
    expect(twilio.perRecipient).toBeCloseTo(0.0083, 6)
    expect(twilio.perRecipient).not.toBeCloseTo(telnyx.perRecipient, 6)

    const telnyxMms = estimateCampaignCost({ recipients: 10, segments: 1, hasMedia: true, provider: "telnyx" })
    const twilioMms = estimateCampaignCost({ recipients: 10, segments: 1, hasMedia: true, provider: "twilio" })
    expect(telnyxMms.perRecipient).toBeCloseTo(0.024, 6)
    expect(twilioMms.perRecipient).toBeCloseTo(0.02, 6)
  })

  test("rateLabel flips with hasMedia; provider defaults to telnyx", () => {
    expect(estimateCampaignCost({ recipients: 1, segments: 1, hasMedia: false }).rateLabel).toBe("SMS")
    expect(estimateCampaignCost({ recipients: 1, segments: 1, hasMedia: true }).rateLabel).toBe("MMS")
    // default provider is telnyx
    expect(estimateCampaignCost({ recipients: 1, segments: 2, hasMedia: false }).perRecipient).toBeCloseTo(0.016, 6)
  })

  test("segments floor at 1 and recipients floor at 0", () => {
    expect(estimateCampaignCost({ recipients: 5, segments: 0, hasMedia: false }).perRecipient).toBeCloseTo(0.008, 6)
    expect(estimateCampaignCost({ recipients: -3, segments: 2, hasMedia: false }).total).toBe(0)
  })
})

describe("formatUsd (unchanged)", () => {
  test("sub-dollar uses 4 decimals; larger rounds", () => {
    expect(formatUsd(0.024)).toBe("$0.0240")
    expect(formatUsd(12.4)).toBe("$12.40")
    expect(formatUsd(1500)).toBe("$1,500")
  })
})
