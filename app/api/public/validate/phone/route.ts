import { NextRequest, NextResponse } from "next/server"

import { formatPhoneE164 } from "@/lib/dedup-utils"
import { lookupNumber, isLineAcceptable } from "@/lib/number-lookup"
import { assertAllowedOrigin, corsHeaders, errorResponse, isRateLimited } from "@/lib/public-api"

export async function OPTIONS(request: NextRequest) {
  const allowed = assertAllowedOrigin(request)
  if (!allowed.ok) return allowed.response
  return new NextResponse(null, { status: 204, headers: corsHeaders(allowed.origin) })
}

export async function POST(request: NextRequest) {
  const allowed = assertAllowedOrigin(request)
  if (!allowed.ok) return allowed.response
  const origin = allowed.origin
  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim()
  if (isRateLimited(ip, "validate-phone", 10)) return errorResponse(429, origin, "rate_limited", "Too many requests")

  const body = await request.json()
  const e164 = formatPhoneE164(body?.phone)
  if (!e164 || !e164.startsWith("+1") || e164.length !== 12) return errorResponse(400, origin, "invalid_phone", "Phone must be valid US E.164")
  const lookup = await lookupNumber(e164)
  const decision = isLineAcceptable(lookup)
  return NextResponse.json({ ok: true, accept: decision.accept, code: decision.code, line_type: decision.lineType, e164 }, { headers: corsHeaders(origin) })
}
