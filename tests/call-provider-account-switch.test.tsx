// The dialer's cached voice provider is per user: a "telnyx" left behind by
// user A (the Telnyx owner org) must never route user B to Telnyx after an
// account switch in the same tab, and sign-out clears every cached entry.

import { act, render } from "@testing-library/react"

const h = vi.hoisted(() => ({
  userId: "user-b" as string | null,
  authListener: null as null | ((event: string) => void),
}))

vi.mock("@telnyx/webrtc", () => ({ TelnyxRTC: class {}, Call: class {} }))
vi.mock("@/components/voice/CallWidget", () => ({ CallWidget: () => null }))
vi.mock("@/components/voice/IncomingRingtone", () => ({ IncomingRingtone: () => null }))
vi.mock("@/hooks/use-permissions", () => ({ usePermissions: () => ({ can: () => true, loading: false }) }))
vi.mock("@/lib/supabase-browser", () => ({
  supabaseBrowser: () => ({
    auth: {
      getSession: async () => ({ data: { session: h.userId ? { user: { id: h.userId }, access_token: "t" } : null } }),
      onAuthStateChange: (cb: (event: string) => void) => {
        h.authListener = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  }),
}))

import {
  CallProvider,
  clearVoiceProviderCache,
  resolveVoiceProviderWithRetry,
  voiceProviderKey,
} from "@/components/voice/CallProvider"

const noSleep = async () => {}
const always401 = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch

beforeEach(() => {
  window.sessionStorage.clear()
  h.userId = "user-b"
  h.authListener = null
})

describe("voice provider cache is per user", () => {
  test("user A's cached telnyx is not user B's fallback", async () => {
    window.sessionStorage.setItem(voiceProviderKey("user-a"), "telnyx")
    expect(await resolveVoiceProviderWithRetry(always401, { userId: "user-b", sleep: noSleep, maxAttempts: 3 })).toBe("blocked")
    expect(await resolveVoiceProviderWithRetry(always401, { userId: "user-a", sleep: noSleep, maxAttempts: 3 })).toBe("telnyx")
  })

  test("a resolved provider is written under the user's own key", async () => {
    const ok = (async () =>
      new Response(JSON.stringify({ provider: "twilio" }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch
    await resolveVoiceProviderWithRetry(ok, { userId: "user-b", sleep: noSleep })
    expect(window.sessionStorage.getItem("listhit.voiceProvider.user-b")).toBe("twilio")
    expect(window.sessionStorage.getItem("listhit:voiceProvider")).toBeNull()
  })

  test("clearVoiceProviderCache drops every user's entry (and the legacy key), nothing else", () => {
    window.sessionStorage.setItem(voiceProviderKey("user-a"), "telnyx")
    window.sessionStorage.setItem(voiceProviderKey("user-b"), "twilio")
    window.sessionStorage.setItem("listhit:voiceProvider", "telnyx")
    window.sessionStorage.setItem("other", "keep")
    clearVoiceProviderCache()
    expect(Object.keys(window.sessionStorage)).toEqual(["other"])
  })
})

describe("CallProvider after an account switch", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test("telnyx cached for user A → user B signs in → B never calls the Telnyx credentials route", async () => {
    vi.useFakeTimers()
    window.sessionStorage.setItem(voiceProviderKey("user-a"), "telnyx")
    h.userId = "user-b"
    const urls: string[] = []
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return new Response("{}", { status: 401 })
    }) as any

    render(
      <CallProvider>
        <div />
      </CallProvider>,
    )
    // Run through every provider-resolution retry (backoff caps at 2s).
    for (let i = 0; i < 12; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
    }

    expect(urls.filter((u) => u.includes("/api/voice/provider")).length).toBeGreaterThanOrEqual(8)
    expect(urls.some((u) => u.includes("/api/telnyx/webrtc-credentials"))).toBe(false)
  })

  test("a SIGNED_OUT auth event clears the cache", async () => {
    window.sessionStorage.setItem(voiceProviderKey("user-a"), "telnyx")
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ provider: "twilio" }), { status: 200 })) as any
    render(
      <CallProvider>
        <div />
      </CallProvider>,
    )
    expect(h.authListener).toBeTypeOf("function")
    act(() => h.authListener!("SIGNED_OUT"))
    expect(window.sessionStorage.getItem(voiceProviderKey("user-a"))).toBeNull()
  })
})
