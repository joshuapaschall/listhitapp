import { type NextRequest } from "next/server"

export function getBearerToken(req: Request | NextRequest): string | null {
  const header = req.headers.get("authorization") || ""
  if (!header.toLowerCase().startsWith("bearer ")) return null
  const token = header.slice(7).trim()
  return token || null
}

export function assertCronAuth(req: Request | NextRequest): void {
  const token = getBearerToken(req)
  const allowedTokens = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(
    Boolean,
  ) as string[]

  if (!token || !allowedTokens.includes(token)) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export function requireCronAuth(req: Request | NextRequest): Response | null {
  try {
    assertCronAuth(req)
    return null
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
