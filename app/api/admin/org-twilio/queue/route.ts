import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { supabaseAdmin } from "@/lib/supabase"
import { requirePlatformAdmin } from "../_shared"

export const dynamic = "force-dynamic"

const STUCK_REVIEW_DAYS = 10

// Orgs that need a platform admin: waiting for spend approval, needing action,
// rejected, or in review for longer than usual.
export async function GET() {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  try {
    const stuckBefore = new Date(Date.now() - STUCK_REVIEW_DAYS * 86_400_000).toISOString()
    const { data, error } = await supabaseAdmin
      .from("org_twilio")
      .select("org_id, setup_stage, brand_type, submitted_at, customer_issues, organizations(name)")
      .or(
        `setup_stage.in.(awaiting_approval,action_required,rejected),and(setup_stage.eq.in_review,submitted_at.lt.${stuckBefore})`,
      )
      .order("submitted_at", { ascending: true })
    if (error) throw error

    const items = ((data ?? []) as any[]).map((row) => ({
      orgId: row.org_id,
      orgName: (Array.isArray(row.organizations) ? row.organizations[0]?.name : row.organizations?.name) ?? null,
      stage: row.setup_stage,
      brandType: row.brand_type,
      submittedAt: row.submitted_at,
      issues: Array.isArray(row.customer_issues) ? row.customer_issues : [],
    }))
    return NextResponse.json({ ok: true, items })
  } catch (err) {
    return apiError(err, 500, undefined, { ok: false })
  }
}
