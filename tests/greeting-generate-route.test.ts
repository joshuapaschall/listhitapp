import { POST } from "../app/api/markets/greeting/generate/route"

// The greeting route authenticates via requireOrgContext + requirePermission on the cookie
// client, then performs the privileged storage write with supabaseAdmin (RLS-bypass).
const state = vi.hoisted(() => ({
  adminUploads: [] as Array<{ bucket: string; path: string }>,
  cookieUploads: [] as Array<{ bucket: string; path: string }>,
}))

function makeStorage(sink: Array<{ bucket: string; path: string }>) {
  return {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          sink.push({ bucket, path })
          return { error: null }
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.test/${bucket}/${path}` },
        }),
      }),
    },
  }
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: makeStorage(state.adminUploads),
}))

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({
    user: { id: "user-1" },
    orgId: "org-1",
    supabase: makeStorage(state.cookieUploads),
  }),
}))

vi.mock("@/lib/permissions/server", () => ({
  requirePermission: async () => null,
}))

describe("/api/markets/greeting/generate", () => {
  beforeEach(() => {
    state.adminUploads.length = 0
    state.cookieUploads.length = 0
  })

  test("uploads a recorded greeting through the admin storage client", async () => {
    const form = new FormData()
    form.set("audio", new File([new Uint8Array([1, 2, 3])], "greeting.webm", { type: "audio/webm" }))
    form.set("scopeKey", "market-123")
    form.set("scopeType", "market")

    const request = new Request("http://test", { method: "POST", body: form })
    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.source).toBe("recorded")

    // The privileged write went through supabaseAdmin, never the cookie client.
    expect(state.adminUploads).toHaveLength(1)
    expect(state.adminUploads[0].bucket).toBe("voicemail-greetings")
    expect(state.cookieUploads).toHaveLength(0)
  })
})
