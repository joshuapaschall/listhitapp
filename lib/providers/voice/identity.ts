// Twilio Voice SDK identity encoding. Constraint: max 121 chars, alphanumeric and
// underscore ONLY — UUID hyphens are illegal. We pack org + user UUIDs (hyphens
// stripped) into `org_<32hex>_user_<32hex>` (73 chars) and restore them on parse.
// The TwiML webhook derives the org from this identity (signed into the JWT by us,
// delivered by Twilio) — never from a client-supplied param.

const HEX32 = /^[0-9a-f]{32}$/i
const IDENTITY_RE = /^org_([0-9a-f]{32})_user_([0-9a-f]{32})$/i

export function buildVoiceIdentity(orgId: string, userId: string): string {
  const o = orgId.replace(/-/g, "")
  const u = userId.replace(/-/g, "")
  if (!HEX32.test(o) || !HEX32.test(u)) {
    throw new Error("buildVoiceIdentity requires UUID orgId and userId")
  }
  return `org_${o.toLowerCase()}_user_${u.toLowerCase()}`
}

function rehydrate(hex32: string): string {
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20)}`
}

export function parseVoiceIdentity(
  identity: string | null | undefined,
): { orgId: string; userId: string } | null {
  const m = (identity ?? "").match(IDENTITY_RE)
  if (!m) return null
  return { orgId: rehydrate(m[1].toLowerCase()), userId: rehydrate(m[2].toLowerCase()) }
}
