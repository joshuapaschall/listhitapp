import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { requirePermission } from "@/lib/permissions/server"

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  role: string | null
  created_at: string | null
}

type PermissionRow = {
  user_id: string
  permission_key: string
  granted: boolean | null
}

export async function GET() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "users.manage")
  if (denied) return denied

  const [profilesResult, permissionsResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, role, created_at")
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("permissions").select("user_id, permission_key, granted"),
  ])

  if (profilesResult.error || permissionsResult.error) {
    console.error(
      "[admin/users] Failed to load users",
      profilesResult.error ?? permissionsResult.error,
    )
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 })
  }

  const grantedByUser = new Map<string, string[]>()
  for (const row of (permissionsResult.data ?? []) as PermissionRow[]) {
    if (row.granted === false) continue
    const list = grantedByUser.get(row.user_id) ?? []
    list.push(row.permission_key)
    grantedByUser.set(row.user_id, list)
  }

  const users = ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => ({
    id: profile.id,
    email: profile.email ?? null,
    fullName: profile.display_name ?? null,
    displayName: profile.display_name ?? null,
    role: profile.role ?? "user",
    createdAt: profile.created_at ?? null,
    permissions: grantedByUser.get(profile.id) ?? [],
  }))

  return NextResponse.json({ users })
}
