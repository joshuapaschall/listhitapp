import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { requirePermission } from "@/lib/permissions/server"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "buyers.edit")
  if (denied) return denied

  try {
    const { tags } = await req.json()
    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: "tags array required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("buyers")
      .update({ tags })
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ buyer: data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 })
  }
}
