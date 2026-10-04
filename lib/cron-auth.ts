import crypto from "node:crypto"

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || ""
  if (!header.toLowerCase().startsWith("bearer ")) return null
  const token = header.slice(7).trim()
  return token || null
}

export function getCronRequestToken(req: Request): string | null {
  const bearerToken = getBearerToken(req)
  if (bearerToken) return bearerToken
  const headerToken = (req.headers.get("x-cron-secret") || "").trim()
  return headerToken || null
}

export function isJwtLike(token: string): boolean {
  const parts = token.split(".")
  return parts.length === 3 && parts.every((part) => part.trim().length > 0)
}

// Constant-time string compare. timingSafeEqual throws on length mismatch, so the
// length is checked first — that leaks only the secret's length, not its bytes.
export function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/** True when the request carries the CRON_SECRET. Never throws. */
export function hasValidCronToken(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token = getCronRequestToken(req)
  if (!token) return false
  return timingSafeEquals(token, secret)
}

export function assertCronAuth(req: Request): string {
  const token = getCronRequestToken(req)
  const secret = process.env.CRON_SECRET

  if (!secret) {
    throw new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!token || !timingSafeEquals(token, secret)) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  return token
}

export function requireCronAuth(req: Request): Response | null {
  const token = getCronRequestToken(req)
  const secret = process.env.CRON_SECRET

  if (!secret || !token || !timingSafeEquals(token, secret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  return null
}
