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
  must_change_password: boolean | null
  org_id: string | null
}

type PermissionsData = {
  role: string
  granted: PermissionKey[]
  mustChangePassword: boolean
  // null = the profile row itself hasn't been read yet, which is different from
  // "read it, and there is no org". Only the latter may trigger onboarding.
  orgId: string | null
  profileLoaded: boolean
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
    // Short enough that a permission an admin just changed converges quickly,
    // long enough that the <Can> blocks on a page still share one fetch.
    staleTime: 60 * 1000,
    queryFn: async () => {
      const [profileResult, permissionsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("role, must_change_password, org_id")
          .eq("id", userId!)
          .maybeSingle<ProfileRow>(),
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

      return {
        role: profileResult.data?.role ?? "user",
        granted: grantedKeys,
        mustChangePassword: profileResult.data?.must_change_password === true,
        orgId: profileResult.data?.org_id ?? null,
        profileLoaded: Boolean(profileResult.data),
      }
    },
  })

  const role = query.data?.role ?? "user"
  const isAdmin = role === "admin" || role === "owner"
  const mustChangePassword = query.data?.mustChangePassword ?? false
  // Unknown until a profile row is actually in hand, so a guard reading this
  // mid-flight never redirects a user who does have an org.
  const profileLoaded = query.data?.profileLoaded === true
  const hasOrg = profileLoaded && Boolean(query.data?.orgId)

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
      mustChangePassword,
      hasOrg,
      profileLoaded,
    }),
    [can, hasOrg, isAdmin, loading, mustChangePassword, profileLoaded, role],
  )
}
