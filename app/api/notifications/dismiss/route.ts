import { NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string }

  if (!body.id) {
    return NextResponse.json({ error: "Notification id is required" }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", body.id)

  if (error) {
    return NextResponse.json({ error: "Failed to dismiss notification" }, { status: 500 })
  }

  return NextResponse.json({ dismissed: true })
}
