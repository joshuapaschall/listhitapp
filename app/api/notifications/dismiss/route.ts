import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"

export async function POST(request: Request) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const body = (await request.json()) as { id?: string }

  if (!body.id) {
    return NextResponse.json({ error: "Notification id is required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", body.id)

  if (error) {
    return NextResponse.json({ error: "Failed to dismiss notification" }, { status: 500 })
  }

  return NextResponse.json({ dismissed: true })
}
