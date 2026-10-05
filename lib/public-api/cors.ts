import { ALLOWED_ORIGINS } from "./origins"

export { ALLOWED_ORIGINS }

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  return ALLOWED_ORIGINS.includes(origin)
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  }
}
