import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { insertNotification } from "@/lib/notifications"
import { sendOfferStatusNotification } from "@/lib/offer-notifications"

type RouteContext = { params: Promise<{ id: string }> }
const OFFER_SELECT = "*, buyers(id,fname,lname,full_name,phone,email,can_receive_sms,can_receive_email), properties(id,address,city,state,zip)"

const statusTimestampMap: Record<string, string> = {
  submitted: "submitted_at",
  accepted: "accepted_at",
  rejected: "rejected_at",
  withdrawn: "withdrawn_at",
  countered: "countered_at",
  closed: "closed_at",
}

export async function GET(_: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { data, error } = await supabaseAdmin.from("offers").select(OFFER_SELECT).eq("id", id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Offer not found" }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const updates = await request.json()

  const { data: current } = await supabaseAdmin.from("offers").select(OFFER_SELECT).eq("id", id).maybeSingle()
  if (!current) return NextResponse.json({ error: "Offer not found" }, { status: 404 })

  const newStatus = typeof updates.status === "string" ? updates.status : null
  const statusChanged = !!newStatus && newStatus !== current.status

  const updatePayload = { ...updates }
  if (statusChanged && newStatus && statusTimestampMap[newStatus]) {
    updatePayload[statusTimestampMap[newStatus]] = new Date().toISOString()
  }

  const { data: updated, error } = await supabaseAdmin
    .from("offers")
    .update(updatePayload)
    .eq("id", id)
    .select(OFFER_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (statusChanged && newStatus) {
    sendOfferStatusNotification(updated, newStatus).catch((err) =>
      console.error("Offer notification error:", err),
    )

    await insertNotification({
      type: `offer_${newStatus}`,
      title: `Offer ${newStatus}: ${updated.properties?.address || "Unknown property"}`,
      body: `${updated.buyers?.full_name || "A buyer"} — $${updated.offer_price || 0}`,
      metadata: { offer_id: updated.id, buyer_id: updated.buyer_id, property_id: updated.property_id },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { data: offer } = await supabaseAdmin.from("offers").select("id,buyer_id,property_id").eq("id", id).maybeSingle()
  const { error } = await supabaseAdmin.from("offers").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await insertNotification({
    type: "offer_deleted",
    title: "Offer deleted",
    metadata: { offer_id: id, buyer_id: offer?.buyer_id, property_id: offer?.property_id },
  })

  return new NextResponse(null, { status: 204 })
}
