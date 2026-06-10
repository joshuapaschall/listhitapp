import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

function s(v: unknown): string {
  return typeof v === "string" ? v : ""
}

// Defaults for the website wizard's `new` mode: business identity already
// captured on the org + verify-business record, so the user never retypes it.
export async function GET() {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  try {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("business_name, address_line1, city, state, zip, phone")
      .eq("id", orgId)
      .maybeSingle()

    const { data: verification } = await supabaseAdmin
      .from("business_verification")
      .select("dba_name, contact_email")
      .eq("org_id", orgId)
      .maybeSingle()

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .maybeSingle()

    return NextResponse.json({
      name: s(verification?.dba_name) || s(org?.business_name) || "",
      business: {
        email: s(verification?.contact_email) || s(profile?.email) || "",
        phone: s(org?.phone),
        address: s(org?.address_line1),
        city: s(org?.city),
        state: s(org?.state),
        zip: s(org?.zip),
      },
    })
  } catch (err) {
    return apiError(err, 500)
  }
}
