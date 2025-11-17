import { supabase, type Buyer, type MessageThread } from "@/lib/supabase"

export interface ThreadWithBuyer extends MessageThread {
  buyers?: Buyer | null
  last_message?: string | null
}
export async function listInboxThreads(
  opts: { starred?: boolean; unread?: boolean } = {},
): Promise<ThreadWithBuyer[]> {
  const query = supabase
    .from("message_threads")
    .select(
      "*, buyers(id,fname,lname,full_name), messages(direction,is_bulk,body,created_at)",
    )
    .is("deleted_at", null)
    .is("messages.deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("created_at", { foreignTable: "messages", ascending: false })
    .limit(1, { foreignTable: "messages" })

  if (typeof opts.starred === "boolean") query.eq("starred", opts.starred)
  if (typeof opts.unread === "boolean") query.eq("unread", opts.unread)

  const { data, error } = await query
  if (error) throw error
  return (data || [])
    .filter((t: any) => t.messages?.[0] && !t.messages[0].is_bulk)
    .filter((t: any) => {
      if (typeof opts.starred === "boolean" && t.starred !== opts.starred) return false
      if (typeof opts.unread === "boolean" && t.unread !== opts.unread) return false
      return true
    })
    .map((t: any) => {
      const { messages, ...rest } = t
      return {
        ...rest,
        last_message: messages?.[0]?.body ?? null,
      } as ThreadWithBuyer
    })
}

export async function listSentThreads(
  opts: { auto?: boolean } = {},
): Promise<ThreadWithBuyer[]> {
  const query = supabase
    .from("message_threads")
    .select(
      "*, buyers(id,fname,lname,full_name), messages(direction,is_bulk,body,created_at)",
    )
    .is("deleted_at", null)
    .is("messages.deleted_at", null)
    .eq("messages.direction", "outbound")
    .order("updated_at", { ascending: false })
    .order("created_at", { foreignTable: "messages", ascending: false })
    .limit(1, { foreignTable: "messages" })

  const { data, error } = await query
  if (error) throw error
  return (data || [])
    .filter((t: any) => t.messages?.[0])
    .filter((t: any) => {
      if (opts.auto === true) {
        return t.messages[0].is_bulk === true
      }
      if (opts.auto === false) {
        return (
          t.messages[0].direction === "outbound" &&
          t.messages[0].is_bulk === false
        )
      }
      return t.messages[0].direction === "outbound"
    })
    .map((t: any) => {
      const { messages, ...rest } = t
      return {
        ...rest,
      last_message: messages?.[0]?.body ?? null,
      } as ThreadWithBuyer
    })
}

export interface AutosentMessage {
  id: string
  body: string | null
  created_at: string
  buyers?: Buyer | null
  message_threads?: MessageThread | null
}

export async function listAutosentMessages(): Promise<AutosentMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id,body,created_at,buyers(id,fname,lname,full_name),message_threads(id,phone_number,starred,unread,updated_at)"
    )
    .eq("direction", "outbound")
    .eq("is_bulk", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data || []) as AutosentMessage[]
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
