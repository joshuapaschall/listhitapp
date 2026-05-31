vi.unmock("@/services/email-metrics-service")
vi.unmock("../services/email-metrics-service")
vi.mock("../services/gmail-metrics-service", () => ({
  getGmailMetrics: vi.fn()
}))

vi.mock("../services/sendfox-service", () => ({
  fetchUnsubscribed: vi.fn().mockResolvedValue([]),
  getEmail: vi.fn()
}))

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        is: () => ({
          not: () => Promise.resolve({ data: [] })
        })
      })
    })
  }
}))

import { updateEmailMetrics } from "../services/email-metrics-service"
import { getGmailMetrics } from "../services/gmail-metrics-service"

describe("updateEmailMetrics", () => {
  test("continues when Gmail metrics fail", async () => {
    ;(getGmailMetrics as vi.Mock).mockRejectedValue(new Error("token"))
    const result = await updateEmailMetrics("u1")
    expect(result).toEqual({ unsubscribed: 0, bounces: 0, opens: 0 })
  })
})
