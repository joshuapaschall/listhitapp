"use client"

import type { ReactNode } from "react"
import { usePermissions } from "@/hooks/use-permissions"
import type { PermissionKey } from "@/lib/permissions/keys"

type PermissionGateProps = {
  permission: PermissionKey
  title: string
  children: ReactNode
}

export function PermissionGate({ permission, title, children }: PermissionGateProps) {
  const { can, loading } = usePermissions()

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Checking permissions...</div>
  }

  if (!can(permission)) {
    return (
      <div className="space-y-2 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to access this settings area.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
