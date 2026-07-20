import { supabase, type Buyer, type MessageThread } from "@/lib/supabase"

export interface ThreadWithBuyer extends MessageThread {
  buyers?: Buyer | null
  last_message?: string | null
  filtered_keyword?: string | null
}

export const INBOX_PAGE_SIZE = 50

export interface ThreadCursor {
  at: string // ISO timestamp of the last row's sort key
  id: string // last row's id (tie-breaker)
}

export interface ThreadPage {
  rows: ThreadWithBuyer[]
  nextCursor: ThreadCursor | null
}

export interface AutosentPage {
  rows: AutosentMessage[]
  nextCursor: ThreadCursor | null
}

// Shared column list for thread tabs. The "last message" now comes from the
// denormalized rollup columns (see 20260720000002_inbox_thread_rollups.sql), so
// there is NO messages(...) embed — that embed is what PostgREST capped at 1,000
// rows and forced the old JS-side tab filtering.
const THREAD_SELECT =
  "id,buyer_id,phone_number,campaign_id,starred,unread,created_at,updated_at,deleted_at,preferred_from_number,filtered_at,filtered_keyword_id,filter_overridden,last_message_at,last_message_body,last_message_direction,last_message_is_bulk,has_inbound,buyers(id,fname,lname,full_name)"

function mapThreadRow(row: any): ThreadWithBuyer {
  return { ...row, last_message: row.last_message_body ?? null } as ThreadWithBuyer
}

// Keyset ("seek") pagination: rows are ordered by (atField desc, id desc); the
// cursor is the last row of the previous page, so the next page is everything
// strictly after it. Far cheaper than OFFSET at volume and immune to the
// 1,000-row cap because each page is its own bounded query.
function withKeyset(query: any, cursor: ThreadCursor | null | undefined, atField: string): any {
  if (!cursor) return query
  return query.or(
    `${atField}.lt.${cursor.at},and(${atField}.eq.${cursor.at},id.lt.${cursor.id})`,
  )
}

// Only advertise a next page when this page came back full; a short page is the
// last page.
function nextCursorFrom(rows: any[], atField: string): ThreadCursor | null {
  if (rows.length < INBOX_PAGE_SIZE) return null
  const last = rows[rows.length - 1]
  return { at: last[atField], id: last.id }
}

// Inbox = incoming conversations (has_inbound), not deleted, not filtered.
// Unread / Starred are the same set narrowed by the respective flag. All
// membership is expressed in the query — no client-side filtering.
export async function listInboxThreads(
  opts: { starred?: boolean; unread?: boolean; cursor?: ThreadCursor | null } = {},
): Promise<ThreadPage> {
  let query: any = supabase
    .from("message_threads")
    .select(THREAD_SELECT)
    .is("deleted_at", null)
    .is("filtered_at", null)
    .eq("has_inbound", true)

  if (opts.starred === true) query = query.eq("starred", true)
  if (opts.unread === true) query = query.eq("unread", true)

  query = withKeyset(query, opts.cursor, "last_message_at")

  const { data, error } = await query
    .order("last_message_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(INBOX_PAGE_SIZE)
  if (error) throw error

  const raw = data || []
  return { rows: raw.map(mapThreadRow), nextCursor: nextCursorFrom(raw, "last_message_at") }
}

// Sent = threads whose most-recent message is a MANUAL outbound
// (direction='outbound' AND is_bulk=false), not deleted, not filtered.
export async function listSentThreads(
  opts: { cursor?: ThreadCursor | null } = {},
): Promise<ThreadPage> {
  let query: any = supabase
    .from("message_threads")
    .select(THREAD_SELECT)
    .is("deleted_at", null)
    .is("filtered_at", null)
    .eq("last_message_direction", "outbound")
    .eq("last_message_is_bulk", false)

  query = withKeyset(query, opts.cursor, "last_message_at")

  const { data, error } = await query
    .order("last_message_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(INBOX_PAGE_SIZE)
  if (error) throw error

  const raw = data || []
  return { rows: raw.map(mapThreadRow), nextCursor: nextCursorFrom(raw, "last_message_at") }
}

// Filtered = threads with filtered_at set. Ordered by filtered_at (keyset uses
// filtered_at, not last_message_at).
export async function listFilteredThreads(
  opts: { cursor?: ThreadCursor | null } = {},
): Promise<ThreadPage> {
  let query: any = supabase
    .from("message_threads")
    .select(THREAD_SELECT)
    .is("deleted_at", null)
    .not("filtered_at", "is", null)

  query = withKeyset(query, opts.cursor, "filtered_at")

  const { data, error } = await query
    .order("filtered_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(INBOX_PAGE_SIZE)
  if (error) throw error

  const raw = data || []
  const rows = raw.map(mapThreadRow)

  // Best-effort: resolve the matched keyword text for the row chip — per page,
  // over just this page's rows.
  const keywordIds = Array.from(
    new Set(rows.map((t: ThreadWithBuyer) => t.filtered_keyword_id).filter(Boolean)),
  ) as string[]
  if (keywordIds.length) {
    const { data: kws } = await supabase
      .from("negative_keywords")
      .select("id,keyword")
      .in("id", keywordIds)
    const byId = new Map((kws || []).map((k: any) => [k.id, k.keyword]))
    rows.forEach((t: ThreadWithBuyer) => {
      t.filtered_keyword = t.filtered_keyword_id ? byId.get(t.filtered_keyword_id) ?? null : null
    })
  }

  return { rows, nextCursor: nextCursorFrom(raw, "filtered_at") }
}

export async function restoreFilteredThread(threadId: string): Promise<void> {
  const { error } = await supabase
    .from("message_threads")
    .update({ filter_overridden: true, filtered_at: null, filtered_keyword_id: null })
    .eq("id", threadId)
  if (error) throw error
}

export interface AutosentMessage {
  id: string
  body: string | null
  created_at: string
  buyers?: Buyer | null
  message_threads?: MessageThread | null
}

// Autosent = individual BULK outbound messages (not threads).
export async function listAutosentMessages(
  opts: { cursor?: ThreadCursor | null } = {},
): Promise<AutosentPage> {
  let query: any = supabase
    .from("messages")
    .select(
      "id,body,created_at,buyers(id,fname,lname,full_name),message_threads(id,phone_number,starred,unread,updated_at)",
    )
    .eq("direction", "outbound")
    .eq("is_bulk", true)
    .is("deleted_at", null)

  if (opts.cursor) {
    query = query.or(
      `created_at.lt.${opts.cursor.at},and(created_at.eq.${opts.cursor.at},id.lt.${opts.cursor.id})`,
    )
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(INBOX_PAGE_SIZE)
  if (error) throw error

  const raw = data || []
  const rows = raw.map((m: any) => ({
    ...m,
    buyers: Array.isArray(m.buyers) ? (m.buyers[0] ?? null) : (m.buyers ?? null),
    message_threads: Array.isArray(m.message_threads)
      ? (m.message_threads[0] ?? null)
      : (m.message_threads ?? null),
  })) as AutosentMessage[]

  return { rows, nextCursor: nextCursorFrom(raw, "created_at") }
}

export async function countUnreadThreads(): Promise<number> {
  const { count, error } = await supabase
    .from("message_threads")
    .select("id", { count: "exact", head: true })
    .eq("unread", true)
    .is("deleted_at", null)
  if (error) throw error
  return count || 0
}

export async function getThreadByBuyer(buyerId: string): Promise<ThreadWithBuyer | null> {
  const { data, error } = await supabase
    .from("message_threads")
    .select("*, buyers(id,fname,lname,full_name)")
    .eq("buyer_id", buyerId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as ThreadWithBuyer) || null
}
