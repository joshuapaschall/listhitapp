import { NextRequest, NextResponse } from "next/server"
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"

// Comma-separated list of branded short-link hostnames (e.g. "go.georgiawholesalehomes.com").
// Lowercased once at module load.
const SHORT_LINK_DOMAINS = (process.env.SHORT_LINK_DOMAINS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

export async function middleware(req: NextRequest) {
  // ============================================================
  // (1) SHORT-LINK HOSTNAME ROUTING (must run BEFORE auth checks)
  // ============================================================
  const rawHost = req.headers.get("host") || ""
  const host = rawHost.toLowerCase().split(":")[0]

  if (SHORT_LINK_DOMAINS.length > 0 && SHORT_LINK_DOMAINS.includes(host)) {
    const pathname = req.nextUrl.pathname

    // The bare root of a branded short-link domain must NOT serve the app.
    // Permanently redirect to the main marketing site so search engines deindex it.
    if (pathname === "/") {
      return NextResponse.redirect("https://georgiawholesalehomes.com/", 308)
    }

    // Don't intercept Next.js internals, the rewritten /r/* target, etc.
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/r/") ||
      pathname === "/favicon.ico" ||
      pathname === "/robots.txt"
    ) {
      return NextResponse.next()
    }

    // Extract the first path segment as the slug; rewrite to /r/<slug>.
    const slug = pathname.slice(1).split("/")[0]
    if (slug) {
      const url = req.nextUrl.clone()
      url.pathname = `/r/${slug}`
      return NextResponse.rewrite(url)
    }

    return NextResponse.next()
  }

  // ============================================================
  // (2) EXISTING AUTH LOGIC (only runs on the main app domain)
  // ============================================================
  const { pathname } = req.nextUrl

  const allowedPrefixes = [
    "/signup",
    "/login",
    "/auth/callback",
    "/api/",
    "/unsubscribe",
    "/r/", // public short-link redirects (defense-in-depth even on main domain)
  ]

  const isAllowedPath = allowedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  )

  if (isAllowedPath) {
    return NextResponse.next()
  }

  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data } = await supabase.auth.getSession()
  const session = data.session

  if (!session && !isAllowedPath) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return res
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
}
