// Single source of truth for the env-controlled fallback org.
//
// Lives apart from lib/auth/org-context.ts on purpose: org-context pulls in
// next/headers + the auth helpers, which server-side writers (webhook handlers,
// queue workers, notification senders) must not import. Those writers only need
// the validated env value.
//
// Validation matters. DEFAULT_ORG_ID is stamped straight into uuid columns, so a
// non-UUID value (a pasted API key, a stray quote) must resolve to null rather
// than reach Postgres and blow up with 22P02 — the guards that check "did we
// resolve an org?" would otherwise pass on garbage.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let warned = false

export function resolveDefaultOrgId(): string | null {
  const envOrg = process.env.DEFAULT_ORG_ID?.trim()
  if (!envOrg) return null
  if (UUID_RE.test(envOrg)) return envOrg

  if (!warned) {
    warned = true
    console.error(
      "[default-org] DEFAULT_ORG_ID is set but is not a UUID — treating it as unset. " +
        "Org-less writes will now fail loudly instead of landing in the wrong tenant.",
    )
  }
  return null
}
