import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isPermissionKey, type PermissionKey } from "./keys"

type SupabaseLikeClient = Pick<SupabaseClient, "auth" | "from">

type PermissionRow = {
  permission_key: string | null
}

type ProfileRow = {
  role: string | null
}

async function getCurrentUser(client: SupabaseLikeClient) {
  const {
    data: { user },
  } = await client.auth.getUser()

  return user ?? null
}

export async function getUserPermissions(
  client: SupabaseLikeClient,
  userId: string
): Promise<{ role: string; granted: Set<PermissionKey> }> {
  const [{ data: profile }, { data: permissions }] = await Promise.all([
    client.from("profiles").select("role").eq("id", userId).maybeSingle<ProfileRow>(),
    client
      .from("permissions")
      .select("permission_key")
      .eq("user_id", userId)
      .eq("granted", true),
  ])

  const granted = new Set<PermissionKey>()

  for (const row of (permissions ?? []) as PermissionRow[]) {
    if (row.permission_key && isPermissionKey(row.permission_key)) {
      granted.add(row.permission_key)
    }
  }

  return {
    role: profile?.role ?? "user",
    granted,
  }
}

export async function hasPermission(
  client: SupabaseLikeClient,
  key: PermissionKey
): Promise<boolean> {
  const user = await getCurrentUser(client)
  if (!user) return false

  const permissions = await getUserPermissions(client, user.id)
  return permissions.role === "admin" || permissions.granted.has(key)
}

export async function requirePermission(
  client: SupabaseLikeClient,
  key: PermissionKey
): Promise<NextResponse | null> {
  const user = await getCurrentUser(client)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const permissions = await getUserPermissions(client, user.id)
  if (permissions.role === "admin" || permissions.granted.has(key)) {
    return null
  }

  return NextResponse.json(
    { error: "Forbidden", missingPermission: key },
    { status: 403 }
  )
}
