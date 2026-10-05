import { NextResponse } from "next/server"

import { requirePermission } from "@/lib/permissions/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requireTelnyxPinnedOrg } from "@/lib/auth/telnyx-guard"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })
  const denied = await requirePermission(supabase, "calls.make_receive")
  if (denied) return denied
  const notPinned = requireTelnyxPinnedOrg(orgId)
  if (notPinned) return notPinned

  const id = params.id
  const r = await fetch(`${TELNYX_API_URL}/calls/${id}/actions/record_start`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({ channels: "dual" }),
  })
  const d = await r.json().catch(() => ({}))
  return NextResponse.json(d, { status: r.status })
}
