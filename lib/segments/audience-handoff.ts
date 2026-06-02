// Encode/decode a SegmentDefinition for the `?audience=` handoff from the Buyers
// page to the new-campaign entry. base64url so it's URL-safe; definitions are small.
import { validateDefinition } from "./resolver"
import type { SegmentDefinition } from "./types"

function toBase64(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8").toString("base64")
  // Browser fallback.
  return btoa(unescape(encodeURIComponent(s)))
}
function fromBase64(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "base64").toString("utf8")
  return decodeURIComponent(escape(atob(s)))
}

export function encodeAudienceParam(def: SegmentDefinition): string {
  return toBase64(JSON.stringify(def)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// Decode + validate. Returns null on any malformed / invalid input (never throws).
export function decodeAudienceParam(raw?: string): SegmentDefinition | null {
  if (!raw) return null
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/")
    const def = JSON.parse(fromBase64(b64)) as SegmentDefinition
    validateDefinition(def)
    return def
  } catch {
    return null
  }
}
