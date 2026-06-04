import { NextRequest, NextResponse } from "next/server"
import { getOrgScopedClient } from "@/lib/auth/scoped-db"
import { requirePermission } from "@/lib/permissions/server"
import { addBuyerToDnc, addRawPhoneToDnc, listDnc } from "@/lib/dnc/service"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await getOrgScopedClient()
    if (!user || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const denied = await requirePermission(supabase, "buyers.view")
    if (denied) return denied

    const { searchParams } = req.nextUrl
    const search = searchParams.get("search") || ""
    const page = Number(searchParams.get("page") || "1") || 1
    const pageSize = Number(searchParams.get("pageSize") || "25") || 25

    const result = await listDnc(orgId, { search, page, pageSize })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error("[dnc] GET error", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await getOrgScopedClient()
    if (!user || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const denied = await requirePermission(supabase, "buyers.edit")
    if (denied) return denied

    const body = await req.json().catch(() => ({}))
    const buyerId = typeof body?.buyerId === "string" ? body.buyerId : null
    const phone = typeof body?.phone === "string" ? body.phone : null
    const reason = typeof body?.reason === "string" ? body.reason : "manual"
    const channels = {
      sms: body?.channels?.sms !== false,
      email: body?.channels?.email !== false,
      calls: body?.channels?.calls !== false,
    }

    if (buyerId) {
      await addBuyerToDnc(orgId, buyerId, channels, reason)
    } else if (phone) {
      await addRawPhoneToDnc(orgId, phone, reason)
    } else {
      return NextResponse.json({ error: "buyerId or phone required" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[dnc] POST error", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
