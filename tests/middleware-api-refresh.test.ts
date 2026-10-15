// Middleware refreshes the Supabase session for session-backed API routes (so
// route handlers never see an expired access token), never redirects an API
// request, and leaves sessionless routes (webhooks, cron, public) alone.

import { NextRequest } from "next/server"

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  createMiddlewareClient: vi.fn(),
  refreshedCookie: null as string | null,
}))

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createMiddlewareClient: (ctx: { req: any; res: any }) => {
    h.createMiddlewareClient(ctx)
    return {
      auth: {
        getSession: async () => {
          h.getSession()
          if (h.refreshedCookie) ctx.res.headers.append("set-cookie", h.refreshedCookie)
          return { data: { session: { access_token: "new" } } }
        },
      },
    }
  },
}))

import { isSessionlessApiPath, middleware } from "@/middleware"

const req = (path: string, cookie = "sb-auth-token=old") =>
  new NextRequest(`http://localhost${path}`, { headers: { host: "localhost", cookie } })

beforeEach(() => {
  h.getSession.mockReset()
  h.createMiddlewareClient.mockReset()
  h.refreshedCookie = null
})

describe("middleware — API session refresh", () => {
  test("/api/voice/provider triggers exactly one session refresh and is not redirected", async () => {
    const res = await middleware(req("/api/voice/provider"))
    expect(h.getSession).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    expect(res.headers.get("location")).toBeNull()
  })

  test("refreshed cookies go to the browser AND are forwarded to the route handler", async () => {
    h.refreshedCookie = "sb-auth-token=new-token; Path=/; SameSite=Lax"
    const res = await middleware(req("/api/notifications"))
    expect(res.headers.getSetCookie().join("\n")).toContain("sb-auth-token=new-token")
    // NextResponse.next({ request: { headers } }) exposes overridden request headers.
    expect(res.headers.get("x-middleware-request-cookie")).toContain("sb-auth-token=new-token")
  })

  test("/api/webhooks/twilio-status does not touch the session", async () => {
    const res = await middleware(req("/api/webhooks/twilio-status"))
    expect(h.getSession).not.toHaveBeenCalled()
    expect(h.createMiddlewareClient).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
  })

  test.each(["/api/cron/registration", "/api/public/buyers", "/api/sms-campaigns/process", "/api/email-campaigns/process"])(
    "%s is sessionless",
    async (path) => {
      expect(isSessionlessApiPath(path)).toBe(true)
      await middleware(req(path))
      expect(h.getSession).not.toHaveBeenCalled()
    },
  )

  test("an API request without a session is never redirected to /login", async () => {
    const res = await middleware(req("/api/notifications", ""))
    expect(res.headers.get("location")).toBeNull()
  })
})
