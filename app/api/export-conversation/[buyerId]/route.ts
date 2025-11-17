import { NextRequest } from "next/server"
import { formatConversationAsCSV, formatConversationAsJSON } from "@/lib/conversation-export"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function GET(request: NextRequest, { params }: { params: { buyerId: string } }) {
  const format = request.nextUrl.searchParams.get("format") || "json"
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required")
  }
  const { supabaseAdmin } = await import("@/lib/supabase")
  const supabase = supabaseAdmin

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("buyer_id", params.buyerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching messages", error)
    return new Response(JSON.stringify({ error: "fetch failed" }), { status: 500 })
  }

  const msgs = data || []
  const body =
    format === "csv"
      ? formatConversationAsCSV(msgs as any)
      : formatConversationAsJSON(msgs as any)
  const headers = new Headers()
  headers.set("Content-Type", format === "csv" ? "text/csv" : "application/json")
  headers.set(
    "Content-Disposition",
    `attachment; filename=conversation-${params.buyerId}.${format === "csv" ? "csv" : "json"}`,
  )
  return new Response(body, { headers })
}
