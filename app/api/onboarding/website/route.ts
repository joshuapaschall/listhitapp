import { NextRequest, NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { supabaseAdmin } from "@/lib/supabase"
import { SiteService } from "@/services/site-service"
import { upsertStepStatus } from "@/lib/onboarding/service"

export const dynamic = "force-dynamic"

// Mirror the organization PATCH gate: only owner/admin may write.
async function requireOwnerAdmin(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  const role = profile?.role
  return role === "owner" || role === "admin"
}

export async function PUT(request: NextRequest) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  if (!(await requireOwnerAdmin(user.id))) return apiError("Forbidden", 403)

  let body: { source?: string; url?: unknown; attested?: unknown }
  try {
    body = await request.json()
  } catch {
    return apiError("Invalid JSON body", 400)
  }

  let websiteUrl: string

  if (body.source === "listhit") {
    const sites = await SiteService.list(supabase, orgId)
    const published = (sites || []).find((s: any) => s.status === "published")
    if (!published) return apiError("Publish your ListHit site first", 400)
    websiteUrl = `https://${published.slug}.listhit.io`
  } else if (body.source === "external") {
    if (body.attested !== true) {
      return apiError("Please confirm your site has an opt-in notice and a privacy policy", 400)
    }
    const raw = typeof body.url === "string" ? body.url.trim() : ""
    if (!raw) return apiError("Enter a valid https:// website address", 400)
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      return apiError("Enter a valid https:// website address", 400)
    }
    if (parsed.protocol !== "https:") {
      return apiError("Enter a valid https:// website address", 400)
    }
    websiteUrl = parsed.toString()
  } else {
    return apiError("Invalid source", 400)
  }

  try {
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ website_url: websiteUrl })
      .eq("id", orgId)
    if (error) throw new Error(error.message)

    await upsertStepStatus(orgId, "website", "done")

    return NextResponse.json({ ok: true, website_url: websiteUrl })
  } catch (err) {
    return apiError(err, 500)
  }
}
