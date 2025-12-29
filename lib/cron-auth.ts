export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || ""
  if (!header.toLowerCase().startsWith("bearer ")) return null
  const token = header.slice(7).trim()
  return token || null
}

export function requireCronAuth(req: Request): Response | null {
  const token = getBearerToken(req)
  const allowedTokens = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(
    Boolean,
  )

  if (!token || !allowedTokens.includes(token)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // TODO: Remove SUPABASE_SERVICE_ROLE_KEY fallback once all cron jobs are rescheduled to CRON_SECRET.
  return null
}
