import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { removeProjectDomain, vercelConfigured } from "@/lib/vercel/domains"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string; domainId: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 })

  const { id: siteId, domainId } = await context.params
  try {
    const { data: site } = await supabase.from("sites").select("id").eq("id", siteId).eq("org_id", orgId).maybeSingle()
    if (!site) return NextResponse.json({ ok: false, error: "Site not found" }, { status: 404 })

    const { data: row } = await supabase
      .from("site_domains")
      .select("*")
      .eq("org_id", orgId)
      .eq("site_id", siteId)
      .eq("id", domainId)
      .maybeSingle()
    if (!row) return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 })

    if (vercelConfigured()) {
      await removeProjectDomain(row.domain)
    }

    const { error } = await supabase.from("site_domains").delete().eq("org_id", orgId).eq("id", domainId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err, 500, undefined, { ok: false })
  }
}
