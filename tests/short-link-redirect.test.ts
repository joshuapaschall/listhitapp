import { NextRequest } from "next/server"
import { beforeEach, describe, expect, test, vi } from "vitest"

const mockSupabaseRpc = vi.fn()
const mockMaybeSingle = vi.fn()

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          eq: (_col2: string, _val2: string) => ({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    }),
    rpc: mockSupabaseRpc,
  }),
}))

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
  mockSupabaseRpc.mockReset()
  // .then() chain support for fire-and-forget RPC
  mockSupabaseRpc.mockReturnValue({
    then: (resolve: (val: { error: unknown }) => void) => {
      resolve({ error: null })
    },
  })
  mockMaybeSingle.mockReset()
})

async function importRoute() {
  vi.resetModules()
  return await import("../app/r/[slug]/route")
}

function makeRequest(host: string, ua: string) {
  return new NextRequest("https://" + host + "/r/abc123", {
    method: "GET",
    headers: {
      host,
      "user-agent": ua,
    },
  })
}

describe("short link redirect route", () => {
  test("happy path: matching link with human UA returns 302 and fires click RPC", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "link-1", target_url: "https://target.test/page", expires_at: null },
      error: null,
    })
    const { GET } = await importRoute()
    const res = await GET(makeRequest("go.example.com", "Mozilla/5.0 (Macintosh)"), {
      params: { slug: "abc123" },
    })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://target.test/page")
    expect(mockSupabaseRpc).toHaveBeenCalledWith("record_short_link_click", {
      p_link_id: "link-1",
    })
  })

  test("bot UA: 302 redirect but no RPC call", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "link-1", target_url: "https://target.test/page", expires_at: null },
      error: null,
    })
    const { GET } = await importRoute()
    const res = await GET(makeRequest("go.example.com", "Slackbot-LinkExpanding 1.0"), {
      params: { slug: "abc123" },
    })
    expect(res.status).toBe(302)
    expect(mockSupabaseRpc).not.toHaveBeenCalled()
  })

  test("unknown slug returns 404 and no RPC call", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const { GET } = await importRoute()
    const res = await GET(makeRequest("go.example.com", "Mozilla/5.0"), {
      params: { slug: "missing" },
    })
    expect(res.status).toBe(404)
    expect(mockSupabaseRpc).not.toHaveBeenCalled()
  })

  test("expired link returns 410 and no RPC call", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString()
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "link-2", target_url: "https://target.test/page", expires_at: past },
      error: null,
    })
    const { GET } = await importRoute()
    const res = await GET(makeRequest("go.example.com", "Mozilla/5.0"), {
      params: { slug: "expired" },
    })
    expect(res.status).toBe(410)
    expect(mockSupabaseRpc).not.toHaveBeenCalled()
  })

  test("empty slug returns 404", async () => {
    const { GET } = await importRoute()
    const res = await GET(makeRequest("go.example.com", "Mozilla/5.0"), {
      params: { slug: "" },
    })
    expect(res.status).toBe(404)
    expect(mockSupabaseRpc).not.toHaveBeenCalled()
  })
})
