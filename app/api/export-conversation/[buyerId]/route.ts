import { NextRequest } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { formatConversationAsCSV, formatConversationAsJSON } from "@/lib/conversation-export"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function GET(request: NextRequest, { params }: { params: { buyerId: string } }) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  if (!orgId) return new Response(JSON.stringify({ error: "Missing org" }), { status: 400 })

  const format = request.nextUrl.searchParams.get("format") || "json"

  const { data: buyer, error: buyerError } = await supabase
    .from("buyers")
    .select("id")
    .eq("id", params.buyerId)
    .maybeSingle()

  if (buyerError) {
    console.error("Error fetching buyer", buyerError)
    return new Response(JSON.stringify({ error: "fetch failed" }), { status: 500 })
  }

  if (!buyer) {
    return new Response(JSON.stringify({ error: "Buyer not found" }), { status: 404 })
  }

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
