import { NextRequest, NextResponse } from "next/server"

export const ALLOWED_ORIGINS = [
  "https://georgiawholesalehomes.com",
  "https://www.georgiawholesalehomes.com",
  "http://localhost:3000",
  "http://localhost:3001",
]

const WINDOW_MS = 60_000
const DEFAULT_LIMIT = 5
const ipHits = new Map<string, number[]>()

export function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}

export function assertAllowedOrigin(request: NextRequest): { ok: true; origin: string } | { ok: false; response: NextResponse } {
  const origin = request.headers.get("origin") || ""
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error_code: "origin_not_allowed", message: "Origin not allowed" }, { status: 403 }),
    }
  }
  return { ok: true, origin }
}

export function isRateLimited(ip: string, limitKey = "default", limit = DEFAULT_LIMIT): boolean {
  const key = `${limitKey}:${ip}`
  const now = Date.now()
  const existing = (ipHits.get(key) || []).filter((ts) => now - ts < WINDOW_MS)
  if (existing.length >= limit) {
    ipHits.set(key, existing)
    return true
  }
  existing.push(now)
  ipHits.set(key, existing)
  return false
}

export function errorResponse(status: number, origin: string, error_code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error_code, message, ...(extra || {}) }, { status, headers: corsHeaders(origin) })
}
