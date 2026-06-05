"use client"

import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { isPermissionKey, type PermissionKey } from "@/lib/permissions/keys"
import { useSession } from "./use-session"

type PermissionRow = {
  permission_key: string | null
}

type ProfileRow = {
  role: string | null
}

type PermissionsData = {
  role: string
  granted: PermissionKey[]
}

export function usePermissions() {
  const { user, loading: sessionLoading } = useSession()
  const userId = user?.id
  const enabled = !sessionLoading && !!userId

  // React Query backs the fetch so every <Can> block and usePermissions()
  // caller on a page shares one cached, deduped result instead of each firing
  // its own pair of Supabase queries on mount. Keyed by user.id (not the user
  // object) so a token refresh returning an identical user does not refetch.
  const query = useQuery<PermissionsData>({
    queryKey: ["permissions", userId],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [profileResult, permissionsResult] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", userId!).maybeSingle<ProfileRow>(),
        supabase
          .from("permissions")
          .select("permission_key")
          .eq("user_id", userId!)
          .eq("granted", true),
      ])

      const grantedKeys: PermissionKey[] = []
      for (const row of (permissionsResult.data ?? []) as PermissionRow[]) {
        if (row.permission_key && isPermissionKey(row.permission_key)) {
          grantedKeys.push(row.permission_key)
        }
      }

      return { role: profileResult.data?.role ?? "user", granted: grantedKeys }
    },
  })

  const role = query.data?.role ?? "user"
  const isAdmin = role === "admin" || role === "owner"

  const granted = useMemo(
    () => new Set<PermissionKey>(query.data?.granted ?? []),
    [query.data],
  )

  // Loading while the session resolves, or while an enabled query is still
  // fetching its first result. With no user the query stays disabled, so this
  // settles to false once the session has loaded.
  const loading = sessionLoading || (enabled && query.isLoading)

  const can = useCallback(
    (key: PermissionKey) => {
      if (loading) return false
      return isAdmin || granted.has(key)
    },
    [granted, isAdmin, loading],
  )

  return useMemo(
    () => ({
      loading,
      role,
      can,
      isAdmin,
    }),
    [can, isAdmin, loading, role],
  )
}
