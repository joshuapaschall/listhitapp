import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { supabaseAdmin } from "@/lib/supabase"
import { getOrgTwilio } from "@/lib/org-twilio/service"
import { provisionMessaging } from "@/lib/org-twilio/provision-messaging"

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
    const result = await provisionMessaging(orgId)
    if (result.ok) return NextResponse.json(result)
    return apiError(result.error ?? "Messaging provisioning failed", 400, result.error)
  } catch (err) {
    return apiError(err, 500)
  }
}
