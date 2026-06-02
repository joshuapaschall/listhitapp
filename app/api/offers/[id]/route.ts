import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { insertNotification } from "@/lib/notifications"
import { sendOfferStatusNotification } from "@/lib/offer-notifications"

type RouteContext = { params: Promise<{ id: string }> }
const OFFER_SELECT = "*, buyers(id,fname,lname,full_name,phone,email,can_receive_sms,can_receive_email), properties(id,address,city,state,zip,buy_price)"


function hasOwn(object: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

async function syncDispositionForOffer({
  supabase,
  orgId,
  offer,
  updates,
  status,
}: {
  supabase: any
  orgId: string
  offer: any
  updates: Record<string, unknown>
  status: string
}) {
  try {
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id,buy_price")
      .eq("id", offer.property_id)
      .maybeSingle()

    if (propertyError) throw propertyError

    const dispositionPatch: Record<string, unknown> = {
      org_id: orgId,
      property_id: offer.property_id,
      buyer_id: offer.buyer_id,
      accepted_offer_id: offer.id,
      buy_price: property?.buy_price ?? null,
      updated_at: new Date().toISOString(),
    }

    if (status === "accepted") {
      dispositionPatch.sale_status = "under_contract"
      dispositionPatch.sale_price = offer.accepted_price ?? offer.offer_price ?? null
      dispositionPatch.assignment_fee = offer.assignment_fee ?? null
      dispositionPatch.closing_expenses = offer.deal_expenses ?? 0
      dispositionPatch.under_contract_date = new Date().toISOString().slice(0, 10)
    }

    if (status === "closed") {
      dispositionPatch.sale_status = "closed"
      dispositionPatch.closing_date = new Date().toISOString().slice(0, 10)

      if (hasOwn(updates, "accepted_price")) {
        dispositionPatch.sale_price = offer.accepted_price ?? null
      }
      if (hasOwn(updates, "assignment_fee")) {
        dispositionPatch.assignment_fee = offer.assignment_fee ?? null
      }
      if (hasOwn(updates, "deal_expenses")) {
        dispositionPatch.closing_expenses = offer.deal_expenses ?? 0
      }
    }

    const { data: existing, error: existingError } = await supabase
      .from("dispositions")
      .select("id")
      .eq("accepted_offer_id", offer.id)
      .maybeSingle()

    if (existingError) throw existingError

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("dispositions")
        .update(dispositionPatch)
        .eq("id", existing.id)
      if (updateError) throw updateError
      return
    }

    const { error: insertError } = await supabase
      .from("dispositions")
      .insert([{ ...dispositionPatch, created_at: new Date().toISOString() }])
    if (insertError) throw insertError
  } catch (err) {
    console.error("Disposition sync error:", err)
  }
}

const statusTimestampMap: Record<string, string> = {
  submitted: "submitted_at",
  accepted: "accepted_at",
  rejected: "rejected_at",
  withdrawn: "withdrawn_at",
  countered: "countered_at",
  closed: "closed_at",
}

export async function GET(_: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const denied = await requirePermission(supabase, "offers.view")
  if (denied) return denied

  const { id } = await context.params
  const { data, error } = await supabase.from("offers").select(OFFER_SELECT).eq("id", id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Offer not found" }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const denied = await requirePermission(supabase, "offers.manage")
  if (denied) return denied

  const { id } = await context.params
  const updates = await request.json()

  const { data: current } = await supabase.from("offers").select(OFFER_SELECT).eq("id", id).maybeSingle()
  if (!current) return NextResponse.json({ error: "Offer not found" }, { status: 404 })

  const newStatus = typeof updates.status === "string" ? updates.status : null
  const statusChanged = !!newStatus && newStatus !== current.status

  const updatePayload = { ...updates }
  if (statusChanged && newStatus && statusTimestampMap[newStatus]) {
    updatePayload[statusTimestampMap[newStatus]] = new Date().toISOString()
  }

  const { data: updated, error } = await supabase
    .from("offers")
    .update(updatePayload)
    .eq("id", id)
    .select(OFFER_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (newStatus === "accepted" || newStatus === "closed") {
    await syncDispositionForOffer({
      supabase,
      orgId,
      offer: updated,
      updates,
      status: newStatus,
    })
  }

  if (statusChanged && newStatus) {
    sendOfferStatusNotification(updated, newStatus).catch((err) =>
      console.error("Offer notification error:", err),
    )
  }

  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const denied = await requirePermission(supabase, "offers.manage")
  if (denied) return denied

  const { id } = await context.params
  const { data: offer } = await supabase.from("offers").select("id,buyer_id,property_id").eq("id", id).maybeSingle()
  const { error } = await supabase.from("offers").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await insertNotification({
    type: "offer_deleted",
    title: "Offer deleted",
    metadata: { offer_id: id, buyer_id: offer?.buyer_id, property_id: offer?.property_id },
  })

  return new NextResponse(null, { status: 204 })
}
