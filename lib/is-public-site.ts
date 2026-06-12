// lib/is-public-site.ts
//
// Client-only heuristic: is the current page a PUBLISHED TENANT SITE (a tenant
// subdomain like acme.listhit.io, or a custom domain) rather than the dashboard
// app host? Dashboard-only providers (notifications poll, realtime sockets) call
// this inside their client effects to avoid firing on public sites, where there
// is no session — the source of the /api/notifications 401s and the realtime
// WebSocket errors in the console.
//
// Server-side (no window) it returns false, which is harmless: these checks only
// run in client effects / client-enabled queries that never execute on the server.
export function isPublicSiteHost(): boolean {
  if (typeof window === "undefined") return false
  const host = window.location.hostname.toLowerCase()
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app")) return false
  const appHost = (process.env.NEXT_PUBLIC_APP_HOST || "app.listhit.io").toLowerCase()
  const root = appHost.split(".").slice(1).join(".") || appHost
  return !(host === appHost || host === root || host === `www.${root}`)
}
