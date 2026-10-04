// Platform-admin allowlist.
//
// A few operations are not "org owner" operations — they affect the whole ListHit
// account (e.g. overriding the SES reputation guard, which resumes sending for
// every tenant at once). Those are gated on an explicit env allowlist of auth
// user ids rather than on a per-org role, so no tenant can grant it to itself.
//
// Unset env var => nobody is a platform admin (fail closed).

export function isPlatformAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false

  const raw = process.env.PLATFORM_ADMIN_USER_IDS
  if (!raw) return false

  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId.trim())
}
