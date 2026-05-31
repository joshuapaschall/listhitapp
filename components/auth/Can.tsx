"use client"

import type { ReactNode } from "react"
import { usePermissions } from "@/hooks/use-permissions"
import type { PermissionKey } from "@/lib/permissions/keys"

type CanProps = {
  permission: PermissionKey
  fallback?: ReactNode
  children: ReactNode
}

type CanAnyProps = {
  permissions: readonly PermissionKey[]
  fallback?: ReactNode
  children: ReactNode
}

export function Can({ permission, fallback = null, children }: CanProps) {
  const { can } = usePermissions()

  if (!can(permission)) return <>{fallback}</>

  return <>{children}</>
}

export function CanAny({ permissions, fallback = null, children }: CanAnyProps) {
  const { can } = usePermissions()

  if (!permissions.some((permission) => can(permission))) return <>{fallback}</>

  return <>{children}</>
}
