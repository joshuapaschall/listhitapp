// Static files in public/ are never auth-gated: Gmail's image proxy fetches the
// email logo with no session. Pages still redirect to /login without one.

import { NextRequest } from "next/server"

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createMiddlewareClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}))

import { config, isPublicAssetPath, middleware } from "@/middleware"

const req = (path: string) => new NextRequest(`https://app.listhit.io${path}`, { headers: { host: "app.listhit.io" } })

// Next compiles the matcher source as a full-path regex.
const matcher = new RegExp(`^${config.matcher[0]}$`)

describe("public static assets", () => {
  test.each(["/brand/icon.png", "/email-assets/social/x.png", "/email-templates/invite.html", "/sounds/on-hold.mp3", "/favicon.ico", "/placeholder.svg", "/sw.js", "/fonts/inter.woff2"])(
    "%s is excluded from the middleware matcher",
    (path) => {
      expect(matcher.test(path)).toBe(false)
    },
  )

  test.each(["/dashboard", "/login", "/getting-started/texting", "/api/voice/provider", "/"])("%s still runs middleware", (path) => {
    expect(matcher.test(path)).toBe(true)
  })

  test("/brand/icon.png passes through without a session", async () => {
    expect(isPublicAssetPath("/brand/icon.png")).toBe(true)
    const res = await middleware(req("/brand/icon.png"))
    expect(res.headers.get("location")).toBeNull()
    expect(res.status).toBe(200)
  })

  test("/dashboard without a session redirects to /login", async () => {
    const res = await middleware(req("/dashboard"))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login")
  })

  test("/sounds/ stays public", async () => {
    const res = await middleware(req("/sounds/on-hold.mp3"))
    expect(res.headers.get("location")).toBeNull()
  })
})
