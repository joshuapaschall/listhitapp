import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Platform-admin gate shared by the registration admin routes.
export async function requirePlatformAdmin(): Promise<{ userId: string } | NextResponse> {
  const { user } = await requireOrgContext()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (!isPlatformAdmin(user.id)) {
    return NextResponse.json({ ok: false, error: "Platform admin only" }, { status: 403 })
  }
  return { userId: user.id }
}

export async function readOrgId(request: Request): Promise<{ orgId: string; body: any } | NextResponse> {
  const body = await request.json().catch(() => null)
  const orgId = typeof body?.orgId === "string" ? body.orgId.trim() : ""
  if (!UUID_RE.test(orgId)) {
    return NextResponse.json({ ok: false, error: "orgId (uuid) is required" }, { status: 400 })
  }
  return { orgId, body }
}
