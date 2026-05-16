import { NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { ids?: string[] }
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : []

  if (!ids.length) {
    return NextResponse.json({ updated: 0 })
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null)
    .select("id")

  if (error) {
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }

  return NextResponse.json({ updated: data?.length ?? 0 })
}
