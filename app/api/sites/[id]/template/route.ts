import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { SiteService } from "@/services/site-service"
import { getSiteTemplate } from "@/lib/site-builder/templates"
import type { SiteTemplateId } from "@/lib/site-builder/types"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const { id } = await context.params

  let body: { templateId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body?.templateId || !getSiteTemplate(body.templateId as SiteTemplateId)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 })
  }

  try {
    const existing = await SiteService.get(supabase, orgId, id)
    if (!existing) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    await SiteService.switchTemplate(supabase, orgId, id, body.templateId as SiteTemplateId)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to switch template" }, { status: 500 })
  }
}
