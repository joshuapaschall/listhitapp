"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { isPermissionKey, type PermissionKey } from "@/lib/permissions/keys"
import { useSession } from "./use-session"

type PermissionRow = {
  permission_key: string | null
}

type ProfileRow = {
  role: string | null
}

export function usePermissions() {
  const { user, loading: sessionLoading } = useSession()
  const [role, setRole] = useState("user")
  const [granted, setGranted] = useState<Set<PermissionKey>>(() => new Set())
  const [permissionsLoading, setPermissionsLoading] = useState(true)

  useEffect(() => {
    let active = true

    if (sessionLoading) {
      setPermissionsLoading(true)
      return () => {
        active = false
      }
    }

    if (!user) {
      setRole("user")
      setGranted(new Set())
      setPermissionsLoading(false)
      return () => {
        active = false
      }
    }

    setPermissionsLoading(true)

    Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<ProfileRow>(),
      supabase
        .from("permissions")
        .select("permission_key")
        .eq("user_id", user.id)
        .eq("granted", true),
    ])
      .then(([profileResult, permissionsResult]) => {
        if (!active) return

        const nextGranted = new Set<PermissionKey>()
        for (const row of (permissionsResult.data ?? []) as PermissionRow[]) {
          if (row.permission_key && isPermissionKey(row.permission_key)) {
            nextGranted.add(row.permission_key)
          }
        }

        setRole(profileResult.data?.role ?? "user")
        setGranted(nextGranted)
      })
      .catch((error) => {
        console.error("Permission lookup failed", error)
        if (!active) return
        setRole("user")
        setGranted(new Set())
      })
      .finally(() => {
        if (active) setPermissionsLoading(false)
      })

    return () => {
      active = false
    }
  }, [sessionLoading, user])

  const loading = sessionLoading || permissionsLoading
  const isAdmin = role === "admin" || role === "owner"

  const can = useCallback(
    (key: PermissionKey) => {
      if (loading) return false
      return isAdmin || granted.has(key)
    },
    [granted, isAdmin, loading]
  )

  return useMemo(
    () => ({
      loading,
      role,
      can,
      isAdmin,
    }),
    [can, isAdmin, loading, role]
  )
}
