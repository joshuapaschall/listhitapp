import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { requirePermission } from "@/lib/permissions/server"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"
import { ensureUserTelephonyCredential } from "@/lib/telnyx/credentials"

/**
 * Generates a throwaway password the invited user never sees or uses. They set
 * their own password via the "set your password" email sent below, mirroring
 * SendText.io's invite flow — admins never handle a password.
 */
function throwawayPassword(): string {
  const bytes = new Uint8Array(24)
  globalThis.crypto.getRandomValues(bytes)
  const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  // Append a fixed suffix so the value always satisfies complexity policies.
  return `${random}Aa1!`
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(supabase, "users.manage")
  if (denied) return denied

  const { email, fullName, role } = await request.json()
  if (!email || !role) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  if (role !== "user" && role !== "admin") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const { data: currentUserData } = await supabase.auth.getUser()
  let orgId: string | null = null
  if (currentUserData.user?.id) {
    try {
      orgId = await resolveOrgIdForUser(currentUserData.user.id)
    } catch (orgError) {
      console.error("[create-user] Failed to resolve creator org", orgError)
    }
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: throwawayPassword(),
    user_metadata: fullName ? { display_name: fullName } : undefined,
  })
  if (error) return apiError(error, 400)

  const id = data.user?.id
  if (id) {
    // A DB trigger upserts the profile row on auth-user creation, so upsert here
    // to set the role + display name without colliding on the primary key.
    const profilePayload = { id, email, role, display_name: fullName ?? null, org_id: orgId }
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload)

    if (pErr) {
      const missingOrgColumn = String(pErr.message ?? "").includes("org_id")
      if (!missingOrgColumn) {
        return NextResponse.json({ error: "Profile insert failed" }, { status: 500 })
      }

      const { error: retryErr } = await supabaseAdmin
        .from("profiles")
        .upsert({ id, email, role, display_name: fullName ?? null })
      if (retryErr) return NextResponse.json({ error: "Profile insert failed" }, { status: 500 })
    }

    // Send a "set your password" email so the invited user chooses their own
    // password — no password is ever returned to the admin.
    try {
      await (supabaseAdmin.auth.admin as any).resetPasswordForEmail(email)
    } catch (resetError) {
      console.error("[create-user] Failed to send invite email", resetError)
    }

    try {
      await ensureUserTelephonyCredential(id)
    } catch (telephonyError) {
      console.error("[create-user] Failed to provision Telnyx credential", telephonyError)
    }
  }

  return NextResponse.json({ ok: true, user: data.user })
}
