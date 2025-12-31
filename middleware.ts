import { NextRequest, NextResponse } from "next/server"
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const allowedPrefixes = [
    "/signup",
    "/login",
    "/auth/callback",
    "/api/",
    "/unsubscribe",
  ]

  const isAllowedPath = allowedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
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
