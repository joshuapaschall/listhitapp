import "@testing-library/jest-dom/vitest"
import { afterAll, afterEach, beforeAll, vi } from "vitest"
import { TextDecoder, TextEncoder } from "util"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

// Polyfills for jose / NextAuth / web crypto
;(global as any).TextEncoder = TextEncoder
;(global as any).TextDecoder = TextDecoder

// Stub Audio for components touching `new Audio()`
;(global as any).Audio = class {
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  load = vi.fn()
  currentTime = 0
  loop = false
}

// Polyfill ResizeObserver for recharts in jsdom
;(global as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Defensive BigInt serialization
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

// Global module mocks (replaces Jest's moduleNameMapper for non-path-alias entries)
vi.mock("@/lib/supabase-browser", () => ({
  __esModule: true,
  supabaseBrowser: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }),
}))

vi.mock("@/lib/supabase", async () => {
  const mod = await import("./__mocks__/supabase")
  return mod
})

vi.mock("@/lib/supabase/admin", async () => {
  const mod = await import("./__mocks__/supabaseAdmin")
  return mod
})

vi.mock("@/lib/telnyx/credentials", async () => {
  const mod = await import("./__mocks__/telnyxCredentials")
  return mod
})

vi.mock("@supabase/auth-helpers-nextjs", async () => {
  const mod = await import("./__mocks__/supabaseAuthHelpers")
  return mod
})

vi.mock("@ffmpeg/ffmpeg", async () => {
  const mod = await import("./__mocks__/ffmpeg-wasm")
  return mod
})

vi.mock("@/services/email-metrics-service", async () => {
  const mod = await import("./__mocks__/email-metrics-service")
  return mod
})

vi.mock("next/headers", async () => {
  const mod = await import("./__mocks__/next-headers")
  return mod
})

// MSW server for Telnyx HTTP (uses MSW v2 syntax)
const server = setupServer(
  http.post("https://api.telnyx.com/v2/telephony_credentials/:id/token", () =>
    HttpResponse.json({
      data: { token: "test-token", expires_at: new Date().toISOString() },
    })
  ),
  http.post("https://api.telnyx.com/v2/telephony_credentials", () => {
    const connectionId =
      process.env.TELNYX_SIP_CONNECTION_ID ||
      process.env.SIP_CONNECTION_ID ||
      process.env.SIP_CREDENTIAL_CONNECTION_ID ||
      process.env.VOICE_CONNECTION_ID ||
      process.env.TELNYX_VOICE_CONNECTION_ID ||
      process.env.CALL_CONTROL_APP_ID ||
      "voice-conn-1"
    return HttpResponse.json({
      data: { id: "cred_123", username: "sip_123", connection_id: connectionId },
    })
  })
)

beforeAll(() => {
  try {
    server.listen({ onUnhandledRequest: "warn" })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes("already patched")) throw err
    server.resetHandlers()
  }
})
afterEach(() => server.resetHandlers())
afterAll(() => {
  try {
    server.close()
  } catch {
    // worker may have already torn down
  }
})
