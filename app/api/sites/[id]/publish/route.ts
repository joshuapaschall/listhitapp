import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { SiteService } from "@/services/site-service"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const { id } = await context.params

  let body: { unpublish?: boolean } = {}
  try {
    body = (await request.json()) || {}
  } catch {
    body = {}
  }

  try {
    if (body.unpublish) {
      const site = await SiteService.unpublish(supabase, orgId, id)
      return NextResponse.json({ site })
    }
    const result = await SiteService.publish(supabase, orgId, id)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to publish site" }, { status: 500 })
  }
}
