export const runtime = "nodejs"
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    const { error } = await supabaseAdmin
      .from("agents")
      .delete()
      .eq("id", params.id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[agents] route error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    const body = await req.json()
    const updates: any = {}

    if (typeof body.display_name === "string")
      updates.display_name = body.display_name.trim()
    if (typeof body.sip_username === "string")
      updates.sip_username = body.sip_username.trim()
    if (typeof body.status === "string") updates.status = body.status

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No changes" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("agents")
      .update(updates)
      .eq("id", params.id)
      .select("id")
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, id: data.id })
  } catch (err: any) {
    console.error("[agents] route error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    )
  }
}
