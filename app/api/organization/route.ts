import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const ORGANIZATION_SELECT =
  "id,name,business_name,address_line1,address_line2,city,state,zip,country,website_url,phone,owner_id"
const ORGANIZATION_UPDATE_FIELDS = [
  "business_name",
  "address_line1",
  "address_line2",
  "city",
  "state",
  "zip",
  "country",
  "website_url",
  "phone",
] as const

type OrganizationUpdateField = (typeof ORGANIZATION_UPDATE_FIELDS)[number]

function pickOrganizationUpdates(body: unknown) {
  const updates: Partial<Record<OrganizationUpdateField, string | null>> = {}
  if (!body || typeof body !== "object") return updates

  const source = body as Record<string, unknown>
  for (const field of ORGANIZATION_UPDATE_FIELDS) {
    if (field in source) {
      const value = source[field]
      updates[field] = typeof value === "string" ? value : null
    }
  }

  return updates
}

export async function GET() {
  const { user, orgId } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  const { data: organization, error } = await supabaseAdmin
    .from("organizations")
    .select(ORGANIZATION_SELECT)
    .eq("id", orgId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "Failed to load organization" }, { status: 500 })
  }

  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  return NextResponse.json(organization)
}

export async function PATCH(request: Request) {
  const { user, orgId } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: "Failed to verify role" }, { status: 500 })
  }

  const role = profile?.role
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const updates = pickOrganizationUpdates(body)

  const query = Object.keys(updates).length
    ? supabaseAdmin
        .from("organizations")
        .update(updates)
        .eq("id", orgId)
        .select(ORGANIZATION_SELECT)
        .maybeSingle()
    : supabaseAdmin
        .from("organizations")
        .select(ORGANIZATION_SELECT)
        .eq("id", orgId)
        .maybeSingle()

  const { data: organization, error } = await query

  if (error) {
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
  }

  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  return NextResponse.json(organization)
}
