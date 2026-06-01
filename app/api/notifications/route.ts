import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"

export async function GET() {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  // If this returns "relation does not exist" error, run the migration in supabase/migrations/20260516_create_notifications.sql
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) {
    console.error("Notifications fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function PATCH(request: Request) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const body = (await request.json()) as { ids?: string[] }
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : []

  if (!ids.length) {
    return NextResponse.json({ updated: 0 })
  }

  const { data, error } = await supabase
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
