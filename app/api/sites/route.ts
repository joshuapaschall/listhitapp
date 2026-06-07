import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { SiteService } from "@/services/site-service"
import { PERSONAS } from "@/lib/site-builder/templates"
import { getSiteTemplate } from "@/lib/site-builder/templates"
import type { SitePersona, SiteTemplateId } from "@/lib/site-builder/types"

export async function GET() {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  try {
    const sites = await SiteService.list(supabase, orgId)
    return NextResponse.json({ sites })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to list sites" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  let body: { name?: string; persona?: string; templateId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const name = (body?.name || "").trim()
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }
  if (!body?.persona || !(body.persona in PERSONAS)) {
    return NextResponse.json({ error: "Unknown persona" }, { status: 400 })
  }
  if (!body?.templateId || !getSiteTemplate(body.templateId as SiteTemplateId)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 })
  }

  try {
    const site = await SiteService.create(supabase, orgId, {
      name,
      persona: body.persona as SitePersona,
      templateId: body.templateId as SiteTemplateId,
    })
    return NextResponse.json({ site }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create site" }, { status: 500 })
  }
}
