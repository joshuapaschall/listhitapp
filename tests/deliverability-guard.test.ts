import { describe, expect, test } from "vitest"
import { evaluateCampaignSafety } from "@/lib/email/deliverability-guard"

describe("evaluateCampaignSafety", () => {
  test("does not trip for a clean campaign", () => {
    expect(evaluateCampaignSafety({ sent: 100, hardBounces: 0, complaints: 0 })).toEqual({
      trip: false,
      bounceRate: 0,
      complaintRate: 0,
    })
  })

  test("trips on hard bounces at 8% when floors are met", () => {
    expect(evaluateCampaignSafety({ sent: 100, hardBounces: 8, complaints: 0 })).toEqual({
      trip: true,
      reason: "bounce",
      bounceRate: 0.08,
      complaintRate: 0,
    })
  })

  test("does not trip on bounces before the sent floor", () => {
    const verdict = evaluateCampaignSafety({ sent: 40, hardBounces: 10, complaints: 0 })

    expect(verdict.trip).toBe(false)
    expect(verdict.bounceRate).toBe(0.25)
  })

  test("does not trip on bounces before the hard-bounce floor", () => {
    const verdict = evaluateCampaignSafety({ sent: 50, hardBounces: 4, complaints: 0 })

    expect(verdict.trip).toBe(false)
    expect(verdict.bounceRate).toBe(0.08)
  })

  test("trips on complaints at 0.2% with at least two complaints", () => {
    expect(evaluateCampaignSafety({ sent: 1000, hardBounces: 0, complaints: 2 })).toEqual({
      trip: true,
      reason: "complaint",
      bounceRate: 0,
      complaintRate: 0.002,
    })
  })

  test("does not trip on one complaint", () => {
    const verdict = evaluateCampaignSafety({ sent: 500, hardBounces: 0, complaints: 1 })

    expect(verdict.trip).toBe(false)
    expect(verdict.complaintRate).toBe(0.002)
  })

  test("gives bounce precedence when both thresholds trip", () => {
    expect(evaluateCampaignSafety({ sent: 1000, hardBounces: 80, complaints: 2 })).toEqual({
      trip: true,
      reason: "bounce",
      bounceRate: 0.08,
      complaintRate: 0.002,
    })
  })
})
