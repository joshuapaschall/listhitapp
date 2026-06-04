import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const authState = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
}))

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: authState.user }, error: null }) },
  }),
}))

let POST: any
const fetchMock = vi.fn()
// @ts-ignore
global.fetch = fetchMock

describe("openai ask route", () => {
  beforeEach(async () => {
    fetchMock.mockReset()
    authState.user = { id: "user-1" }
    process.env.OPENAI_API_KEY = "key"
    vi.resetModules()
    POST = (await import("../app/api/openai/ask/route")).POST
  })

  test("forwards prompt to OpenAI", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Hi" } }] }),
    })
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ prompt: "Hello" }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(fetchMock).toHaveBeenCalled()
    expect(body).toEqual({ result: "Hi" })
  })

  test("rejects unauthenticated requests", async () => {
    authState.user = null
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ prompt: "Hello" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("validates input", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test("throws when API key missing at import", async () => {
    delete process.env.OPENAI_API_KEY
    vi.resetModules()
    await expect(import("../app/api/openai/ask/route")).rejects.toThrow(
      "OpenAI API key not configured",
    )
  })
})
