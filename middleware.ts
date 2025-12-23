import { NextRequest, NextResponse } from "next/server"
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data } = await supabase.auth.getSession()
  const session = data.session

  const { pathname } = req.nextUrl

  const allowedPaths = [
    "/login",
    "/agents/login",
    "/unsubscribe",
    "/api/unsubscribe",
  ]

  const isAllowedPath =
    allowedPaths.includes(pathname) ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"

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
