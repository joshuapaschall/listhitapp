import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { getTwilioClientForOrg } from "@/lib/twilio/org-client"
import { getOrgTwilio, upsertOrgTwilio } from "@/lib/org-twilio/service"
import { provisionBrand } from "@/lib/org-twilio/provision-brand"

export const dynamic = "force-dynamic"

// Platform-admin only until Phase 2B rebuilds tenant provisioning: no tenant
// may trigger a carrier filing (or read the raw provisioning row) from here.

export async function GET() {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)
  if (!isPlatformAdmin(user.id)) return apiError("Forbidden", 403)

  try {
    const row = await getOrgTwilio(orgId)
    if (!row) return NextResponse.json({ a2p_status: "not_started" })
    if (!row.brand_sid) return NextResponse.json(row)

    // Refresh the live BrandRegistration status; persist if it changed.
    const client = await getTwilioClientForOrg(orgId)
    const brand = await client.messaging.v1.brandRegistrations(row.brand_sid).fetch()
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
  if (!isPlatformAdmin(user.id)) return apiError("Forbidden", 403)

  try {
    const result = await provisionBrand(orgId)
    if (result.ok) return NextResponse.json(result)
    return apiError(result.error ?? "Brand provisioning failed", 400, result.error)
  } catch (err) {
    return apiError(err, 500)
  }
}
