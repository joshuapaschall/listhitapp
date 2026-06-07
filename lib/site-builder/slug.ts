export function slugifySiteName(input: string): string {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "") // re-trim in case the 40-char cut left a trailing dash
}

export const RESERVED_SLUGS: Set<string> = new Set([
  "app",
  "www",
  "api",
  "admin",
  "mail",
  "ftp",
  "dev",
  "staging",
  "sites",
  "r",
  "login",
  "signup",
  "auth",
])

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has((slug || "").toLowerCase())
}
