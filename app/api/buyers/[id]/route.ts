import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { requirePermission } from "@/lib/permissions/server"

// Columns the Add/Edit Buyer modals legitimately write (derived from
// components/buyers/edit-buyer-modal.tsx updateData and add-buyer-modal.tsx
// insertData). Anything not listed here is dropped before the update, so a
// crafted PATCH body cannot mass-assign identity/ownership columns (id,
// created_at, deleted_at, org_id, etc.).
const BUYER_PATCH_ALLOWED_FIELDS = [
  // Contact
  "fname",
  "lname",
  "full_name",
  "display_name",
  "company",
  "email",
  "phone",
  "phone2",
  "phone3",
  "website",
  "mailing_address",
  "mailing_city",
  "mailing_state",
  "mailing_zip",
  // Location & property preferences
  "locations",
  "property_type",
  // Price / spec preferences
  "asking_price_min",
  "asking_price_max",
  "year_built_min",
  "year_built_max",
  "sqft_min",
  "sqft_max",
  "beds_min",
  "baths_min",
  // Investment criteria
  "min_arv",
  "min_arv_percent",
  "min_gross_margin",
  "max_gross_margin",
  // Owner finance / rent-to-own
  "down_payment_min",
  "down_payment_max",
  "monthly_payment_min",
  "monthly_payment_max",
  // Status & notes
  "status",
  "score",
  "vip",
  "vetted",
  "can_receive_email",
  "can_receive_sms",
  "source",
  "notes",
  "tags",
  "property_interest",
  "updated_at",
] as const

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "buyers.edit")
  if (denied) return denied

  try {
    const payload = await req.json()
    if (!payload || Array.isArray(payload) || typeof payload !== "object") {
      return NextResponse.json({ error: "update payload required" }, { status: 400 })
    }

    // Drop any field not on the allowlist to prevent mass-assignment.
    const sanitized = Object.fromEntries(
      Object.entries(payload).filter(([k]) => (BUYER_PATCH_ALLOWED_FIELDS as readonly string[]).includes(k)),
    )
    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: "no editable fields in payload" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("buyers")
      .update(sanitized)
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ buyer: data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 })
  }
}
