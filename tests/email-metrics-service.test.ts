import { describe, test, expect, jest } from "@jest/globals"

jest.mock("../services/gmail-metrics-service", () => ({
  getGmailMetrics: jest.fn()
}))

jest.mock("../services/sendfox-service", () => ({
  fetchUnsubscribed: jest.fn().mockResolvedValue([]),
  getEmail: jest.fn()
}))

jest.mock("../lib/supabase", () => ({
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
    ;(getGmailMetrics as jest.Mock).mockRejectedValue(new Error("token"))
    const result = await updateEmailMetrics("u1")
    expect(result).toEqual({ unsubscribed: 0, bounces: 0, opens: 0 })
  })
})
