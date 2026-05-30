import { describe, expect, test } from "vitest"
import { evaluateAccountState } from "@/lib/email/deliverability-guard"

describe("evaluateAccountState", () => {
  test("stays healthy under account-wide thresholds", () => {
    expect(
      evaluateAccountState({
        windowSent: 1000,
        hardBounces: 10,
        complaints: 0,
        enforcementStatus: "HEALTHY",
        sendingEnabled: true,
      }),
    ).toEqual({
      state: "healthy",
      reason: null,
      bounceRate: 0.01,
      complaintRate: 0,
    })
  })

  test("freezes when enforcement status is PROBATION", () => {
    expect(
      evaluateAccountState({
        windowSent: 1000,
        hardBounces: 0,
        complaints: 0,
        enforcementStatus: "PROBATION",
        sendingEnabled: true,
      }),
    ).toMatchObject({
      state: "frozen",
      reason: "enforcement:PROBATION",
    })
  })

  test("freezes when enforcement status is SHUTDOWN", () => {
    expect(
      evaluateAccountState({
        windowSent: 1000,
        hardBounces: 0,
        complaints: 0,
        enforcementStatus: "SHUTDOWN",
        sendingEnabled: true,
      }),
    ).toMatchObject({
      state: "frozen",
      reason: "enforcement:SHUTDOWN",
    })
  })

  test("freezes when account sending is disabled", () => {
    expect(
      evaluateAccountState({
        windowSent: 1000,
        hardBounces: 0,
        complaints: 0,
        enforcementStatus: "HEALTHY",
        sendingEnabled: false,
      }),
    ).toMatchObject({
      state: "frozen",
      reason: "sending_disabled",
    })
  })

  test("freezes on bounce rate at the freeze threshold with enough volume", () => {
    expect(
      evaluateAccountState({
        windowSent: 500,
        hardBounces: 20,
        complaints: 0,
        enforcementStatus: "HEALTHY",
        sendingEnabled: true,
      }),
    ).toEqual({
      state: "frozen",
      reason: "rate",
      bounceRate: 0.04,
      complaintRate: 0,
    })
  })

  test("freezes on complaint rate at the freeze threshold with enough volume", () => {
    expect(
      evaluateAccountState({
        windowSent: 1250,
        hardBounces: 0,
        complaints: 1,
        enforcementStatus: "HEALTHY",
        sendingEnabled: true,
      }),
    ).toEqual({
      state: "frozen",
      reason: "rate",
      bounceRate: 0,
      complaintRate: 0.0008,
    })
  })

  test("warns when bounce rate is in the warning band", () => {
    expect(
      evaluateAccountState({
        windowSent: 1000,
        hardBounces: 30,
        complaints: 0,
        enforcementStatus: "HEALTHY",
        sendingEnabled: true,
      }),
    ).toEqual({
      state: "warn",
      reason: "rate",
      bounceRate: 0.03,
      complaintRate: 0,
    })
  })

  test("warns when complaint rate is in the warning band", () => {
    expect(
      evaluateAccountState({
        windowSent: 2000,
        hardBounces: 0,
        complaints: 1,
        enforcementStatus: "HEALTHY",
        sendingEnabled: true,
      }),
    ).toEqual({
      state: "warn",
      reason: "rate",
      bounceRate: 0,
      complaintRate: 0.0005,
    })
  })

  test("stays healthy below minimum volume even with a high rate and healthy enforcement", () => {
    expect(
      evaluateAccountState({
        windowSent: 100,
        hardBounces: 20,
        complaints: 1,
        enforcementStatus: "HEALTHY",
        sendingEnabled: true,
      }),
    ).toEqual({
      state: "healthy",
      reason: null,
      bounceRate: 0.2,
      complaintRate: 0.01,
    })
  })

  test("is divide-by-zero safe when no messages are in the window", () => {
    expect(
      evaluateAccountState({
        windowSent: 0,
        hardBounces: 0,
        complaints: 0,
        enforcementStatus: "HEALTHY",
        sendingEnabled: true,
      }),
    ).toEqual({
      state: "healthy",
      reason: null,
      bounceRate: 0,
      complaintRate: 0,
    })
  })
})
