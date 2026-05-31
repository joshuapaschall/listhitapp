import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { requirePermission } from "@/lib/permissions/server"

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "buyers.edit")
  if (denied) return denied

  try {
    const payload = await req.json()
    if (!payload || Array.isArray(payload) || typeof payload !== "object") {
      return NextResponse.json({ error: "buyer payload required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("buyers")
      .insert([payload])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ buyer: data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 })
  }
}
