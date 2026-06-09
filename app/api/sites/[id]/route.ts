import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { SiteService, type BlockPatch } from "@/services/site-service"
import type { SiteTheme, SiteBusiness, SiteMarkets } from "@/lib/site-builder/types"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const { id } = await context.params
  try {
    const result = await SiteService.get(supabase, orgId, id)
    if (!result) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load site" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const { id } = await context.params

  let body: {
    name?: string
    slug?: string
    theme?: Partial<SiteTheme>
    business?: Partial<SiteBusiness>
    markets?: Partial<SiteMarkets>
    blockPatches?: BlockPatch[]
    tracking?: Record<string, unknown>
    deals_public?: boolean
    pageUpdates?: { path: string; enabled: boolean }[]
    pageData?: { path: string; data: any }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    // Make sure the site is in this org before mutating anything.
    const existing = await SiteService.get(supabase, orgId, id)
    if (!existing) return NextResponse.json({ error: "Site not found" }, { status: 404 })

    if (body.name !== undefined || body.slug !== undefined) {
      await SiteService.updateMeta(supabase, orgId, id, { name: body.name, slug: body.slug })
    }
    if (body.theme) {
      await SiteService.updateTheme(supabase, orgId, id, body.theme)
    }
    if (body.business) {
      await SiteService.updateBusiness(supabase, id, body.business)
    }
    if (body.markets) {
      await SiteService.updateMarkets(supabase, id, body.markets)
    }
    if (Array.isArray(body.blockPatches) && body.blockPatches.length) {
      await SiteService.patchPageBlocks(supabase, orgId, id, body.blockPatches)
    }
    if (Array.isArray(body.pageUpdates) && body.pageUpdates.length) {
      await SiteService.setPagesEnabled(supabase, orgId, id, body.pageUpdates)
    }
    if (body.pageData && typeof body.pageData.path === "string" && body.pageData.data) {
      await SiteService.savePageData(supabase, orgId, id, body.pageData.path, body.pageData.data)
    }
    if (body.tracking && typeof body.tracking === "object") {
      // Keep only the known ad-tag keys, coerced to trimmed strings.
      const src = body.tracking as Record<string, unknown>
      const tracking_json: Record<string, string> = {}
      for (const key of ["ga4_id", "google_ads_id", "google_ads_label", "meta_pixel_id"]) {
        const v = src[key]
        if (typeof v === "string" && v.trim()) tracking_json[key] = v.trim()
      }
      const { error: trackErr } = await supabase
        .from("sites")
        .update({ tracking_json })
        .eq("id", id)
        .eq("org_id", orgId)
      if (trackErr) throw new Error(trackErr.message)
    }
    if (typeof body.deals_public === "boolean") {
      const { error: dpErr } = await supabase
        .from("sites")
        .update({ deals_public: body.deals_public })
        .eq("org_id", orgId)
        .eq("id", id)
      if (dpErr) return NextResponse.json({ error: dpErr.message }, { status: 400 })
    }

    const result = await SiteService.get(supabase, orgId, id)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update site" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const { id } = await context.params
  try {
    const { error } = await supabase.from("sites").delete().eq("id", id).eq("org_id", orgId)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete site" }, { status: 500 })
  }
}
