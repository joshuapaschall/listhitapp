import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { requirePermission } from "@/lib/permissions/server"
import { sendShowingConfirmation } from "@/lib/showing-notifications"

const SHOWING_SELECT = "*, buyers(id,fname,lname,full_name,phone,email,can_receive_sms,can_receive_email), properties(id,address,city,state,zip)"

export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "showings.view")
  if (denied) return denied

  const search = request.nextUrl.searchParams
  const status = search.get("status")
  const startDate = search.get("startDate")
  const endDate = search.get("endDate")
  const buyerId = search.get("buyerId")
  const propertyId = search.get("propertyId")

  let query = supabaseAdmin.from("showings").select(SHOWING_SELECT).order("scheduled_at", { ascending: false })

  if (buyerId) query = query.eq("buyer_id", buyerId)
  if (propertyId) query = query.eq("property_id", propertyId)
  if (status) query = query.eq("status", status)
  if (startDate) query = query.gte("scheduled_at", startDate)
  if (endDate) query = query.lte("scheduled_at", endDate)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "showings.manage")
  if (denied) return denied

  const body = await request.json()
  if (!body?.scheduled_at) {
    return NextResponse.json({ error: "scheduled_at is required" }, { status: 400 })
  }

  const { data: created, error } = await supabaseAdmin
    .from("showings")
    .insert({
      buyer_id: body.buyer_id || null,
      property_id: body.property_id || null,
      scheduled_at: body.scheduled_at,
      status: body.status || "scheduled",
      notes: body.notes || null,
    })
    .select("id")
    .single()

  if (error || !created) return NextResponse.json({ error: error?.message || "Failed to create showing" }, { status: 500 })

  const { data: showing, error: fetchError } = await supabaseAdmin
    .from("showings")
    .select(SHOWING_SELECT)
    .eq("id", created.id)
    .single()

  if (fetchError || !showing) return NextResponse.json({ error: fetchError?.message || "Failed to fetch showing" }, { status: 500 })

  sendShowingConfirmation(showing, showing.buyers, showing.properties).catch((err) =>
    console.error("Notification error:", err),
  )

  return NextResponse.json(showing, { status: 201 })
}
