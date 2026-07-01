import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { supabaseAdmin } from "@/lib/supabase"
import { getTwilioClient } from "@/lib/providers/twilio/client"
import { getOrgTwilio, upsertOrgTwilio } from "@/lib/org-twilio/service"
import { provisionBrand } from "@/lib/org-twilio/provision-brand"

export const dynamic = "force-dynamic"

// Mirror the organization/a2p write gate: only owner/admin may provision.
async function requireOwnerAdmin(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  const role = profile?.role
  return role === "owner" || role === "admin"
}

export async function GET() {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  try {
    const row = await getOrgTwilio(orgId)
    if (!row) return NextResponse.json({ a2p_status: "not_started" })
    if (!row.brand_sid) return NextResponse.json(row)

    // Refresh the live BrandRegistration status; persist if it changed.
    const brand = await getTwilioClient().messaging.v1.brandRegistrations(row.brand_sid).fetch()
    if (brand.status && brand.status !== row.brand_status) {
      const updated = await upsertOrgTwilio(orgId, { brand_status: brand.status })
      return NextResponse.json(updated)
    }
    return NextResponse.json(row)
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function POST() {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  if (!(await requireOwnerAdmin(user.id))) return apiError("Forbidden", 403)

  try {
    const result = await provisionBrand(orgId)
    if (result.ok) return NextResponse.json(result)
    return apiError(result.error ?? "Brand provisioning failed", 400, result.error)
  } catch (err) {
    return apiError(err, 500)
  }
}
