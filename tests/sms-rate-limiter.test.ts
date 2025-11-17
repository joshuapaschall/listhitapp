import { describe, beforeEach, afterEach, test, expect, jest } from "@jest/globals"
import { createSmsRateLimiter } from "../lib/sms-rate-limiter"

describe("sms-rate-limiter", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test("delays requests beyond carrier rate", async () => {
    const limiter = createSmsRateLimiter({ globalMps: 100, carrierMps: 2, tmobileSegments: 100, refreshMs: 3600000 })
    const calls: number[] = []

    const p1 = limiter.scheduleSMS("verizon", "hi", async () => calls.push(Date.now()))
    const p2 = limiter.scheduleSMS("verizon", "hi", async () => calls.push(Date.now()))
    const p3 = limiter.scheduleSMS("verizon", "hi", async () => calls.push(Date.now()))

    await jest.advanceTimersByTimeAsync(1500)
    await Promise.all([p1, p2, p3])

    expect(calls.length).toBe(3)
    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(400)
    expect(calls[2] - calls[1]).toBeGreaterThanOrEqual(400)
  })

  test("tmobile reservoir delays when empty", async () => {
    const limiter = createSmsRateLimiter({ globalMps: 100, carrierMps: 100, tmobileSegments: 3, refreshMs: 100000 })
    const calls: number[] = []
    const body = "a".repeat(161) // 2 segments

    const p1 = limiter.scheduleSMS("T-Mobile", body, async () => calls.push(Date.now()))
    const p2 = limiter.scheduleSMS("T-Mobile", body, async () => calls.push(Date.now()))

    await jest.advanceTimersByTimeAsync(20)
    await p1
    expect(calls.length).toBe(1)

    await jest.advanceTimersByTimeAsync(1000)
    expect(calls.length).toBe(1)

    await jest.advanceTimersByTimeAsync(100002)
    await p2
    expect(calls.length).toBe(2)
  })
})
