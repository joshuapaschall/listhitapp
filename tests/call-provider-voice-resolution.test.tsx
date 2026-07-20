import { describe, it, expect, vi } from "vitest"

// CallProvider.tsx is a "use client" component that pulls in the Telnyx WebRTC SDK
// and a couple of child components at module load. We only exercise the pure
// provider-resolution helper here, so stub those imports to keep the module import
// cheap and side-effect free. (supabase-browser is already globally mocked in
// tests/setup.ts.)
vi.mock("@telnyx/webrtc", () => ({ TelnyxRTC: class {}, Call: class {} }))
vi.mock("@/components/voice/CallWidget", () => ({ CallWidget: () => null }))
vi.mock("@/components/voice/IncomingRingtone", () => ({ IncomingRingtone: () => null }))
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ can: () => true, loading: false }),
}))

import { resolveVoiceProviderWithRetry } from "@/components/voice/CallProvider"

// No real backoff waits in tests.
const noSleep = async () => {}

/** A fetch stub that returns queued responses in order, then repeats the last one. */
function fetchReturning(...responses: Array<() => Response>) {
  let i = 0
  const calls: Array<unknown> = []
  const impl = vi.fn(async (input: unknown) => {
    calls.push(input)
    const factory = responses[Math.min(i, responses.length - 1)]
    i += 1
    return factory()
  }) as unknown as typeof fetch
  return Object.assign(impl, { callCount: () => i })
}

const ok = (body: unknown) =>
  () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })
const unauthorized = () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
const serverError = () => new Response("boom", { status: 500 })

describe("resolveVoiceProviderWithRetry", () => {
  it("retries past a 401 (session not yet hydrated) and resolves the real provider", async () => {
    const fetchImpl = fetchReturning(unauthorized, unauthorized, ok({ provider: "twilio" }))
    const result = await resolveVoiceProviderWithRetry(fetchImpl, { sleep: noSleep, maxAttempts: 8 })
    expect(result).toBe("twilio")
    // The first two 401s did NOT commit; it kept trying until the 200.
    expect((fetchImpl as any).callCount()).toBe(3)
  })

  it("does not commit to telnyx on a first-paint 401", async () => {
    // If the helper failed open, a single 401 followed by a twilio answer would
    // still yield telnyx. It must yield twilio.
    const fetchImpl = fetchReturning(unauthorized, ok({ provider: "twilio" }))
    const result = await resolveVoiceProviderWithRetry(fetchImpl, { sleep: noSleep })
    expect(result).toBe("twilio")
  })

  it("falls back to telnyx only after sustained failure (maxAttempts 401s)", async () => {
    const fetchImpl = fetchReturning(unauthorized)
    const result = await resolveVoiceProviderWithRetry(fetchImpl, { sleep: noSleep, maxAttempts: 4 })
    expect(result).toBe("telnyx")
    expect((fetchImpl as any).callCount()).toBe(4)
  })

  it("commits immediately to telnyx on a 200 { provider: 'telnyx' }", async () => {
    const fetchImpl = fetchReturning(ok({ provider: "telnyx" }))
    const result = await resolveVoiceProviderWithRetry(fetchImpl, { sleep: noSleep })
    expect(result).toBe("telnyx")
    expect((fetchImpl as any).callCount()).toBe(1)
  })

  it("commits immediately to twilio on a 200 { provider: 'twilio' }", async () => {
    const fetchImpl = fetchReturning(ok({ provider: "twilio" }))
    const result = await resolveVoiceProviderWithRetry(fetchImpl, { sleep: noSleep })
    expect(result).toBe("twilio")
    expect((fetchImpl as any).callCount()).toBe(1)
  })

  it("treats a 200 with a junk/unexpected body as inconclusive and keeps retrying", async () => {
    const fetchImpl = fetchReturning(ok({ provider: "bogus" }), ok({ nope: true }), ok({ provider: "twilio" }))
    const result = await resolveVoiceProviderWithRetry(fetchImpl, { sleep: noSleep, maxAttempts: 8 })
    expect(result).toBe("twilio")
    expect((fetchImpl as any).callCount()).toBe(3)
  })

  it("retries through 5xx and network errors, then resolves", async () => {
    const throwOnce = () => {
      throw new Error("network down")
    }
    const fetchImpl = fetchReturning(serverError, throwOnce as any, ok({ provider: "twilio" }))
    const result = await resolveVoiceProviderWithRetry(fetchImpl, { sleep: noSleep, maxAttempts: 8 })
    expect(result).toBe("twilio")
  })

  it("returns null (never sets state) when cancelled before the first call resolves", async () => {
    const fetchImpl = fetchReturning(ok({ provider: "twilio" }))
    const result = await resolveVoiceProviderWithRetry(fetchImpl, {
      sleep: noSleep,
      isCancelled: () => true,
    })
    expect(result).toBeNull()
    // Cancelled before entering the loop body — no fetch fired.
    expect((fetchImpl as any).callCount()).toBe(0)
  })
})
