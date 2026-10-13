import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { getOrgTwilio } from "@/lib/org-twilio/service"
import { buildRegistrationStatus } from "@/lib/org-twilio/status"
import { isOrgTelnyxPinnedEnv } from "@/lib/providers/sms/routing"
import { supabaseAdmin } from "@/lib/supabase"

// Shared gate for the customer texting-setup API: a signed-in owner/admin of a
// non-owner org. The org always comes from the session, never the request.
export type CustomerContext = { userId: string; orgId: string }

export const PINNED_ORG_MESSAGE = "Your account uses ListHit's owner phone system."

async function isOwnerOrAdmin(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle()
  const role = (profile as { role?: string } | null)?.role
  return role === "owner" || role === "admin"
}

export async function requireRegistrationContext(): Promise<CustomerContext | NextResponse> {
  const { user, orgId } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })
  if (!(await isOwnerOrAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (isOrgTelnyxPinnedEnv(orgId)) return NextResponse.json({ error: PINNED_ORG_MESSAGE }, { status: 403 })
  return { userId: user.id, orgId }
}

export async function statusResponse(orgId: string, init?: { status?: number }) {
  return NextResponse.json(buildRegistrationStatus(await getOrgTwilio(orgId)), init)
}
