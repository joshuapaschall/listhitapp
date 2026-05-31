import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { requirePermission } from "@/lib/permissions/server"
import { sendOfferStatusNotification } from "@/lib/offer-notifications"

const OFFER_SELECT = "*, buyers(id,fname,lname,full_name,phone,email,can_receive_sms,can_receive_email), properties(id,address,city,state,zip)"

export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "offers.view")
  if (denied) return denied

  const search = request.nextUrl.searchParams
  const status = search.get("status")
  const buyerId = search.get("buyerId")
  const propertyId = search.get("propertyId")

  let query = supabaseAdmin.from("offers").select(OFFER_SELECT).order("created_at", { ascending: false })

  if (status) query = query.eq("status", status)
  if (buyerId) query = query.eq("buyer_id", buyerId)
  if (propertyId) query = query.eq("property_id", propertyId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "offers.manage")
  if (denied) return denied

  const body = await request.json()

  if (!body?.buyer_id || !body?.property_id) {
    return NextResponse.json({ error: "buyer_id and property_id are required" }, { status: 400 })
  }

  const { data: created, error } = await supabaseAdmin
    .from("offers")
    .insert({
      buyer_id: body.buyer_id,
      property_id: body.property_id,
      offer_type: body.offer_type || null,
      offer_price: body.offer_price || null,
      down_payment: body.down_payment || null,
      monthly_payment: body.monthly_payment || null,
      earnest_money: body.earnest_money || null,
      due_diligence_days: body.due_diligence_days || null,
      proposed_closing_date: body.proposed_closing_date || null,
      status: body.status || "submitted",
      notes: body.notes || null,
    })
    .select("id")
    .single()

  if (error || !created) return NextResponse.json({ error: error?.message || "Failed to create offer" }, { status: 500 })

  const { data: offer, error: fetchError } = await supabaseAdmin
    .from("offers")
    .select(OFFER_SELECT)
    .eq("id", created.id)
    .single()

  if (fetchError || !offer) return NextResponse.json({ error: fetchError?.message || "Failed to fetch offer" }, { status: 500 })

  sendOfferStatusNotification(offer, "submitted").catch((err) =>
    console.error("Offer notification error:", err),
  )

  return NextResponse.json(offer, { status: 201 })
}
