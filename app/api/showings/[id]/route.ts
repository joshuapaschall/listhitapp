import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { insertNotification } from "@/lib/notifications"
import { sendShowingConfirmation } from "@/lib/showing-notifications"

type RouteContext = { params: Promise<{ id: string }> }
const SHOWING_SELECT = "*, buyers(id,fname,lname,full_name,phone,email,can_receive_sms,can_receive_email), properties(id,address,city,state,zip)"

export async function GET(_: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { data, error } = await supabaseAdmin.from("showings").select(SHOWING_SELECT).eq("id", id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Showing not found" }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const updates = await request.json()

  const { data: current } = await supabaseAdmin.from("showings").select(SHOWING_SELECT).eq("id", id).maybeSingle()
  if (!current) return NextResponse.json({ error: "Showing not found" }, { status: 404 })

  const { data: updated, error } = await supabaseAdmin
    .from("showings")
    .update(updates)
    .eq("id", id)
    .select(SHOWING_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (typeof updates.status === "string" && updates.status !== current.status) {
    const type = updates.status === "completed" ? "showing_completed" : updates.status === "canceled" ? "showing_cancelled" : updates.status === "rescheduled" ? "showing_rescheduled" : null
    if (type) {
      await insertNotification({
        type,
        title: `Showing ${updates.status}: ${updated.properties?.address || "Unknown property"}`,
        body: `${updated.buyers?.full_name || "A buyer"}`,
        metadata: { showing_id: updated.id, buyer_id: updated.buyer_id, property_id: updated.property_id },
      })
    }
  }

  if (updates.scheduled_at && updates.scheduled_at !== current.scheduled_at) {
    sendShowingConfirmation(updated, updated.buyers, updated.properties).catch((err) =>
      console.error("Notification error:", err),
    )
  }

  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { data: showing } = await supabaseAdmin.from("showings").select("id,buyer_id,property_id").eq("id", id).maybeSingle()
  const { error } = await supabaseAdmin.from("showings").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await insertNotification({
    type: "showing_deleted",
    title: "Showing deleted",
    metadata: { showing_id: id, buyer_id: showing?.buyer_id, property_id: showing?.property_id },
  })

  return new NextResponse(null, { status: 204 })
}
