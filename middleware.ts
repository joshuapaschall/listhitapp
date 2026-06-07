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
    // Redirect to the parent marketing site by stripping a leading "go." label,
    // using a permanent redirect so search engines deindex the short-link host. This is
    // multi-tenant-safe: each branded domain bounces to its OWN parent site
    // (go.georgiawholesalehomes.com -> georgiawholesalehomes.com, go.acmehomes.com -> acmehomes.com).
    if (pathname === "/") {
      const rootDomain = host.replace(/^go\./, "")
      // If no "go." prefix could be stripped, refuse to serve the app and avoid a
      // redirect loop by returning 404 rather than redirecting the host to itself.
      if (rootDomain === host) {
        return new NextResponse("Not found", { status: 404 })
      }
      return NextResponse.redirect(`https://${rootDomain}/`, 308)
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
  // (1.5) TENANT SITE HOSTNAME ROUTING (after short-link, before auth)
  // ============================================================
  const APP_HOST = (process.env.NEXT_PUBLIC_APP_HOST || "app.listhit.io").toLowerCase()
  const ROOT_DOMAIN = (process.env.SITES_ROOT_DOMAIN || "listhit.io").toLowerCase()
  const RESERVED_SUBDOMAINS = new Set(["app", "www", "api", "admin", "mail", "ftp", "dev", "staging"])

  const isAppHost =
    host === APP_HOST ||
    host === "localhost" ||
    host.endsWith(".vercel.app") ||
    host === ROOT_DOMAIN ||
    host === `www.${ROOT_DOMAIN}`

  // Never expose the internal /sites/* renderer path on the dashboard host.
  if (isAppHost && req.nextUrl.pathname.startsWith("/sites/")) {
    return new NextResponse("Not found", { status: 404 })
  }

  if (!isAppHost && !SHORT_LINK_DOMAINS.includes(host)) {
    let isTenant = false
    if (host.endsWith(`.${ROOT_DOMAIN}`)) {
      const label = host.slice(0, host.length - (`.${ROOT_DOMAIN}`).length).split(".")[0]
      if (label && !RESERVED_SUBDOMAINS.has(label)) isTenant = true
    } else {
      isTenant = true // custom domain pointed at us
    }

    if (isTenant) {
      const p = req.nextUrl.pathname
      if (
        p.startsWith("/_next") ||
        p.startsWith("/api") ||
        p === "/favicon.ico" ||
        p === "/robots.txt"
      ) {
        return NextResponse.next()
      }
      const url = req.nextUrl.clone()
      url.pathname = `/sites/${host}${p === "/" ? "" : p}`
      return NextResponse.rewrite(url)
    }
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
    "/sounds/", // public static audio (hold music) — must be fetchable by Telnyx
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
