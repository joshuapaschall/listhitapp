import type { SupabaseClient } from "@supabase/supabase-js"

export type NegativeKeywordAction = "hide" | "dnc"
export type NegativeKeywordMatchType = "exact" | "phrase"

export interface NegativeKeywordMatch {
  keywordId: string
  action: NegativeKeywordAction
  keyword: string
  matchType: NegativeKeywordMatchType
}

/**
 * Normalize inbound text for soft keyword matching:
 * lowercase, strip URLs, drop non-alphanumerics, collapse whitespace.
 */
export function normalizeForMatch(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const ACTION_PRIORITY: Record<NegativeKeywordAction, number> = { dnc: 2, hide: 1 }

/**
 * Match an inbound message against the org's USER negative keywords.
 * `admin` is the supabaseAdmin (service-role) client; the query is explicitly
 * scoped by org_id, which is mandatory for service-role access.
 *
 * Winner selection: most specific (longest normalized keyword) wins; ties broken
 * by action priority dnc(2) > hide(1). Returns null when nothing matches.
 */
export async function matchNegativeKeyword(
  admin: SupabaseClient,
  orgId: string,
  text: string,
): Promise<NegativeKeywordMatch | null> {
  const normalizedMessage = normalizeForMatch(text)
  if (!normalizedMessage || !orgId) return null

  const { data, error } = await admin
    .from("negative_keywords")
    .select("id,keyword,match_type,action")
    .eq("org_id", orgId)
    .eq("is_system", false)

  if (error) {
    console.error("Failed to load negative keywords", { orgId, error })
    return null
  }

  let winner: NegativeKeywordMatch | null = null
  let winnerLen = -1

  for (const row of data || []) {
    const normalizedKeyword = normalizeForMatch(row.keyword || "")
    if (!normalizedKeyword) continue

    const matchType = (row.match_type as NegativeKeywordMatchType) || "phrase"
    const matched =
      matchType === "exact"
        ? normalizedMessage === normalizedKeyword
        : normalizedMessage.includes(normalizedKeyword)
    if (!matched) continue

    const action = (row.action as NegativeKeywordAction) || "hide"
    const len = normalizedKeyword.length

    const better =
      !winner ||
      len > winnerLen ||
      (len === winnerLen && ACTION_PRIORITY[action] > ACTION_PRIORITY[winner.action])

    if (better) {
      winner = { keywordId: row.id, action, keyword: row.keyword, matchType }
      winnerLen = len
    }
  }

  return winner
}
