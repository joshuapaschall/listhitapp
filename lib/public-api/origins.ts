// The single static CORS allowlist for the public endpoints.
//
// Two copies of this list used to exist (lib/public-api.ts and
// lib/public-api/cors.ts), and both shipped localhost to production — any page
// on a developer's machine could call the public API against live data.
// localhost is now development-only.
//
// Tenant sites are NOT here: they are resolved dynamically by host through
// resolveSiteByHost / isTenantSubdomainOrigin.

const OWNER_SITE_ORIGINS = [
  "https://georgiawholesalehomes.com",
  "https://www.georgiawholesalehomes.com",
]

const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3001"]

export const ALLOWED_ORIGINS = (process.env.NODE_ENV === "production"
  ? OWNER_SITE_ORIGINS
  : [...OWNER_SITE_ORIGINS, ...DEV_ORIGINS]) as readonly string[]
