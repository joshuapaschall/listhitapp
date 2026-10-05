// The single gate that keeps an org's tag vocabulary complete.
//
// Tags are stored on records by NAME (buyers.tags / properties.tags are text[]),
// so a name that never made it into public.tags is invisible to every picker,
// filter and the Settings → Tags page. Every writer that can introduce a tag
// name goes through here first.
//
// Matching is case-insensitive and returns the CANONICAL casing: typing
// "atlanta closers" when "Atlanta Closers" exists must reuse the existing tag
// rather than create a near-duplicate.

import { supabaseAdmin } from "@/lib/supabase"

export async function ensureTagsExist(orgId: string, names: string[]): Promise<string[]> {
  // Trim, drop empties, de-duplicate case-insensitively, keep input order.
  const wanted: string[] = []
  const seen = new Set<string>()
  for (const raw of names ?? []) {
    if (typeof raw !== "string") continue
    const name = raw.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    wanted.push(name)
  }
  if (!wanted.length) return []

  const { data: existing, error } = await supabaseAdmin
    .from("tags")
    .select("name")
    .eq("org_id", orgId)

  if (error) {
    console.error("[tags/ensure] failed to load org tags", { orgId, error })
    throw error
  }

  // lower(name) -> canonical name
  const canonical = new Map<string, string>()
  for (const row of existing ?? []) {
    const name = (row as { name: string | null }).name
    if (name) canonical.set(name.toLowerCase(), name)
  }

  const toCreate = wanted.filter((name) => !canonical.has(name.toLowerCase()))

  if (toCreate.length) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("tags")
      .insert(toCreate.map((name) => ({ org_id: orgId, name })))
      .select("name")

    if (insertError) {
      // 23505 = another request created one of these first. Re-select so we
      // return that writer's canonical casing instead of failing.
      if ((insertError as { code?: string }).code !== "23505") {
        console.error("[tags/ensure] failed to create tags", { orgId, error: insertError })
        throw insertError
      }

      const { data: afterRace } = await supabaseAdmin
        .from("tags")
        .select("name")
        .eq("org_id", orgId)
      for (const row of afterRace ?? []) {
        const name = (row as { name: string | null }).name
        if (name) canonical.set(name.toLowerCase(), name)
      }
    } else {
      for (const row of inserted ?? []) {
        const name = (row as { name: string | null }).name
        if (name) canonical.set(name.toLowerCase(), name)
      }
    }
  }

  // Fall back to the requested name if a row still isn't visible — better to
  // keep the user's tag than to silently drop it.
  return wanted.map((name) => canonical.get(name.toLowerCase()) ?? name)
}
