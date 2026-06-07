import { NextRequest, NextResponse } from "next/server"
import { searchLocations } from "@/lib/location-utils"
import { ALLOWED_ORIGINS, corsHeaders, isRateLimited, isTenantSubdomainOrigin } from "@/lib/public-api"

function originOk(origin: string) {
  return ALLOWED_ORIGINS.includes(origin) || isTenantSubdomainOrigin(origin)
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || ""
  if (!originOk(origin)) return NextResponse.json({ ok: false }, { status: 403 })
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin") || ""
  if (!originOk(origin)) return NextResponse.json({ ok: false, error_code: "origin_not_allowed" }, { status: 403 })

  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim()
  if (isRateLimited(ip, "locations-search", 30)) {
    return NextResponse.json({ ok: false, error_code: "rate_limited", results: [] }, { status: 429, headers: corsHeaders(origin) })
  }

  const q = (request.nextUrl.searchParams.get("q") || "").slice(0, 80)
  const results = q.trim().length > 1 ? searchLocations(q).slice(0, 20) : []
  return NextResponse.json({ ok: true, results }, { headers: corsHeaders(origin) })
}
