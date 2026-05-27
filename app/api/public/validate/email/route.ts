import { NextRequest, NextResponse } from "next/server"

import { normalizeEmail } from "@/lib/dedup-utils"
import { validateEmailDebounce, isEmailAcceptable } from "@/lib/debounce"
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
  if (isRateLimited(ip, "validate-email", 10)) return errorResponse(429, origin, "rate_limited", "Too many requests")

  const body = await request.json()
  const email = normalizeEmail(body?.email)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse(400, origin, "invalid_email", "Email is invalid")
  const verdict = await validateEmailDebounce(email)
  const decision = isEmailAcceptable(verdict)
  return NextResponse.json({ ok: true, accept: decision.accept, code: decision.code, result: verdict.result, did_you_mean: verdict.didYouMean, email }, { headers: corsHeaders(origin) })
}
