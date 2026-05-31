import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { requirePermission } from "@/lib/permissions/server"

type ImportUpdate = {
  id: string
  data: Record<string, any>
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "buyers.import")
  if (denied) return denied

  try {
    const body = await req.json()
    const buyers = Array.isArray(body) ? body : body?.buyers
    const updates = Array.isArray(body?.updates) ? body.updates : []
    const insertedIds: string[] = []
    const updatedIds: string[] = []

    if (buyers !== undefined) {
      if (!Array.isArray(buyers)) {
        return NextResponse.json({ error: "buyers array required" }, { status: 400 })
      }

      if (buyers.length) {
        const { data, error } = await supabase
          .from("buyers")
          .insert(buyers)
          .select("id")

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        insertedIds.push(...((data ?? []) as { id: string }[]).map((buyer) => buyer.id))
      }
    }

    for (const update of updates as ImportUpdate[]) {
      if (!update?.id || !update.data || Array.isArray(update.data) || typeof update.data !== "object") {
        return NextResponse.json({ error: "valid updates required" }, { status: 400 })
      }

      const { data, error } = await supabase
        .from("buyers")
        .update(update.data)
        .eq("id", update.id)
        .select("id")
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (data?.id) updatedIds.push(data.id)
    }

    if (buyers === undefined && updates.length === 0) {
      return NextResponse.json({ error: "buyers or updates required" }, { status: 400 })
    }

    return NextResponse.json({ ids: insertedIds, insertedIds, updatedIds }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 })
  }
}
