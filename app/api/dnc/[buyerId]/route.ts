import { NextRequest, NextResponse } from "next/server"
import { getOrgScopedClient } from "@/lib/auth/scoped-db"
import { requirePermission } from "@/lib/permissions/server"
import { removeBuyerFromDnc } from "@/lib/dnc/service"

export const dynamic = "force-dynamic"

function parseChannels(body: any) {
  // Default: remove from all channels.
  if (!body || typeof body !== "object" || !body.channels) {
    return { sms: true, email: true, calls: true }
  }
  return {
    sms: body.channels.sms !== false,
    email: body.channels.email !== false,
    calls: body.channels.calls !== false,
  }
}

async function handle(req: NextRequest, buyerId: string) {
  const { user, orgId, supabase } = await getOrgScopedClient()
  if (!user || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const denied = await requirePermission(supabase, "buyers.edit")
  if (denied) return denied

  const body = await req.json().catch(() => null)
  const channels = parseChannels(body)
  await removeBuyerFromDnc(orgId, buyerId, channels)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { buyerId: string } }) {
  try {
    return await handle(req, params.buyerId)
  } catch (err: any) {
    console.error("[dnc] DELETE error", { buyerId: params.buyerId, err })
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { buyerId: string } }) {
  try {
    return await handle(req, params.buyerId)
  } catch (err: any) {
    console.error("[dnc] PATCH error", { buyerId: params.buyerId, err })
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
