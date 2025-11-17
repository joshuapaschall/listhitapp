import { supabase } from "@/lib/supabase"

export async function countUnreadEmailThreads(): Promise<number> {
  const { count, error } = await supabase
    .from("email_threads")
    .select("thread_id", { count: "exact", head: true })
    .eq("unread", true)
  if (error) throw error
  return count || 0
}

