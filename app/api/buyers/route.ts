import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/permissions/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { hasContactInfo } from "@/lib/dedup-utils"
import { ensureTagsExist } from "@/lib/tags/ensure"

export async function POST(req: NextRequest) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })
  const denied = await requirePermission(supabase, "buyers.edit")
  if (denied) return denied

  try {
    const payload = await req.json()
    if (!payload || Array.isArray(payload) || typeof payload !== "object") {
      return NextResponse.json({ error: "buyer payload required" }, { status: 400 })
    }

    // Strip any client-supplied org_id so the server-resolved org cannot be spoofed.
    const { org_id: _ignoredOrgId, ...rest } = payload as Record<string, unknown>

    if (!hasContactInfo(rest as any)) {
      return NextResponse.json(
        { error: "A buyer must have at least one email or phone number." },
        { status: 400 },
      )
    }

    // Keep the vocabulary complete and store the canonical casing, so a buyer
    // never carries a tag the pickers and Settings → Tags can't see.
    if (Array.isArray(rest.tags)) {
      rest.tags = await ensureTagsExist(orgId, rest.tags as string[])
    }

    const { data, error } = await supabase
      .from("buyers")
      .insert([{ ...rest, org_id: orgId }])
      .select()
      .single()

    if (error) {
      return apiError(error, 500)
    }

    return NextResponse.json({ buyer: data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 })
  }
}
