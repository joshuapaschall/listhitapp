import { describe, test, expect } from "@jest/globals"

function applyUnsubscribeTrigger(
  message: { body: string; buyer_id: string; filtered?: boolean },
  buyer: { id: string; can_receive_sms: boolean },
  keywords: string[] = []
) {
  let matched = /\b(stop|stopall|unsubscribe|cancel|end|quit)\b/i.test(message.body)
  if (!matched) {
    const lower = message.body.toLowerCase()
    matched = keywords.some(k => lower.includes(k.toLowerCase()))
  }
  if (matched) {
    buyer.can_receive_sms = false
    message.filtered = true
  }
}

describe("unsubscribe trigger", () => {
  test("flags buyer on STOP keyword", () => {
    const buyer = { id: "b1", can_receive_sms: true }
    const msg = { buyer_id: "b1", body: "STOP" }
    applyUnsubscribeTrigger(msg, buyer)
    expect(buyer.can_receive_sms).toBe(false)
    expect(msg.filtered).toBe(true)
  })

  test("flags buyer when negative keyword found", () => {
    const buyer = { id: "b1", can_receive_sms: true }
    const msg = { buyer_id: "b1", body: "this is a scam" }
    applyUnsubscribeTrigger(msg, buyer, ["scam"])
    expect(buyer.can_receive_sms).toBe(false)
    expect(msg.filtered).toBe(true)
  })
})
