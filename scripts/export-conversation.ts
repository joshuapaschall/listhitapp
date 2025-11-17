import { createClient } from "@supabase/supabase-js"
import { formatConversationAsCSV, formatConversationAsJSON } from "../lib/conversation-export"

async function main() {
  const [buyerId, format] = process.argv.slice(2)
  if (!buyerId) {
    console.error("Usage: pnpm ts-node scripts/export-conversation.ts <buyerId> [csv|json]")
    process.exit(1)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required")
  }
  const supabase = createClient(url, key)

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("buyer_id", buyerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching messages", error)
    process.exit(1)
  }

  const msgs = data || []
  if (format === "json") {
    console.log(formatConversationAsJSON(msgs))
  } else {
    console.log(formatConversationAsCSV(msgs))
  }
}

main()
