import { describe, expect, test } from "vitest"
import { evaluateSmsCampaignSafety } from "@/lib/sms/sms-safety-guard"

describe("evaluateSmsCampaignSafety", () => {
  test("does not trip for a clean campaign", () => {
    expect(evaluateSmsCampaignSafety({ sent: 100, failures: 0, optOuts: 0 })).toEqual({
      trip: false,
      failureRate: 0,
      optOutRate: 0,
    })
  })

  test("trips on failures at 12% when floors are met", () => {
    expect(evaluateSmsCampaignSafety({ sent: 100, failures: 12, optOuts: 0 })).toEqual({
      trip: true,
      reason: "failure",
      failureRate: 0.12,
      optOutRate: 0,
    })
  })

  test("does not trip on failures before the sent floor", () => {
    const verdict = evaluateSmsCampaignSafety({ sent: 40, failures: 10, optOuts: 0 })

    expect(verdict.trip).toBe(false)
    expect(verdict.failureRate).toBe(0.25)
  })

  test("does not trip on failures before the failure floor", () => {
    const verdict = evaluateSmsCampaignSafety({ sent: 100, failures: 9, optOuts: 0 })

    expect(verdict.trip).toBe(false)
    expect(verdict.failureRate).toBe(0.09)
  })

  test("trips on opt-outs at 3% with floors met", () => {
    expect(evaluateSmsCampaignSafety({ sent: 100, failures: 0, optOuts: 5 })).toEqual({
      trip: true,
      reason: "optout",
      failureRate: 0,
      optOutRate: 0.05,
    })
  })

  test("does not trip on opt-outs before the sent floor", () => {
    const verdict = evaluateSmsCampaignSafety({ sent: 99, failures: 0, optOuts: 5 })

    expect(verdict.trip).toBe(false)
    expect(verdict.optOutRate).toBe(5 / 99)
  })

  test("gives failure precedence when both thresholds trip", () => {
    expect(evaluateSmsCampaignSafety({ sent: 100, failures: 12, optOuts: 5 })).toEqual({
      trip: true,
      reason: "failure",
      failureRate: 0.12,
      optOutRate: 0.05,
    })
  })

  test("is divide-by-zero safe when nothing has been sent", () => {
    expect(evaluateSmsCampaignSafety({ sent: 0, failures: 10, optOuts: 5 })).toEqual({
      trip: false,
      failureRate: 0,
      optOutRate: 0,
    })
  })
})
