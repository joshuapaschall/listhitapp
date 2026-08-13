import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { requireOrgAdmin } from "@/lib/auth/admin-guard"
import { validatePassword } from "@/lib/auth/password-policy"
import {
  APP_URL,
  resolveOrgName,
  sendAccountReadyEmail,
  sendInviteEmail,
} from "@/lib/email/account-emails"
import { ensureUserTelephonyCredential } from "@/lib/telnyx/credentials"
import { PERMISSION_KEYS } from "@/lib/permissions/keys"
import {
  grantsForTemplate,
  PERMISSION_TEMPLATES,
  type PermissionTemplateId,
} from "@/lib/permissions/templates"

const TEMPLATE_IDS = new Set<string>(PERMISSION_TEMPLATES.map((template) => template.id))

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function alreadyRegistered(error: { message?: string | null } | null): boolean {
  const message = String(error?.message ?? "").toLowerCase()
  return message.includes("already been registered") || message.includes("already registered")
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // Runs first so ctx.orgId is guaranteed non-null before we create anything in
  // auth. A user created without an org is invisible to /api/admin/users and
  // 403s on every mutation — unrecoverable from the UI.
  const guard = await requireOrgAdmin(supabase)
  if ("denied" in guard) return guard.denied
  const { ctx } = guard

  const body = await request.json()
  const {
    email: rawEmail,
    fullName,
    role,
    password,
    requirePasswordChange,
    templateId,
  } = body
  // No method means an old client: invite is what it used to do.
  const method: "invite" | "password" = body.method === "password" ? "password" : "invite"

  const email = typeof rawEmail === "string" ? rawEmail.trim() : ""
  if (!email || !role) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That doesn't look like a valid email." }, { status: 400 })
  }
  if (role !== "user" && role !== "admin") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }
  if (templateId !== undefined && templateId !== null && !TEMPLATE_IDS.has(templateId)) {
    return NextResponse.json({ error: "Invalid template" }, { status: 400 })
  }
  if (method === "password") {
    const passwordError = validatePassword(password)
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  // Check for a duplicate before creating anything, so a rejected request never
  // leaves a half-created auth user behind.
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, org_id")
    .eq("email", email)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      {
        error:
          existing.org_id === ctx.orgId
            ? "That email is already on your team."
            : // Never disclose that the address belongs to another tenant.
              "That email is already registered.",
      },
      { status: 409 },
    )
  }

  const displayName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : null

  let userId: string | undefined
  let hashedToken: string | undefined

  if (method === "invite") {
    // generateLink CREATES the auth user for type "invite" and hands back the
    // token in the same call. It never sends mail — we send it ourselves below.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: displayName ? { display_name: displayName } : undefined,
        redirectTo: `${APP_URL}/set-password`,
      },
    })
    if (error) {
      if (alreadyRegistered(error)) {
        return NextResponse.json({ error: "That email is already registered." }, { status: 409 })
      }
      return apiError(error, 400)
    }
    userId = data.user?.id
    hashedToken = data.properties?.hashed_token
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: displayName ? { display_name: displayName } : undefined,
    })
    if (error) {
      if (alreadyRegistered(error)) {
        return NextResponse.json({ error: "That email is already registered." }, { status: 409 })
      }
      return apiError(error, 400)
    }
    userId = data.user?.id
  }

  if (!userId) {
    console.error("[create-user] Auth user created without an id", { email, method })
    return NextResponse.json({ error: "Could not finish creating that user." }, { status: 500 })
  }

  // A DB trigger already inserted a bare profile row, so upsert to set role,
  // name, and org. org_id is never optional here — there is no fallback path.
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    email,
    role,
    display_name: displayName,
    org_id: ctx.orgId,
    must_change_password:
      method === "password" ? (requirePasswordChange ?? true) === true : false,
    invited_at: method === "invite" ? new Date().toISOString() : null,
  })

  if (profileError) {
    // Roll the auth user back. A user that exists in auth but has no usable
    // profile can sign in and see a broken app, which is worse than no user.
    const { error: rollbackError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    console.error("[create-user] Profile upsert failed; rolled back the auth user", {
      email,
      userId,
      profileError,
      rollbackError,
    })
    return NextResponse.json({ error: "Could not finish creating that user." }, { status: 500 })
  }

  if (templateId) {
    const grants = new Set(grantsForTemplate(templateId as PermissionTemplateId))
    const rows = PERMISSION_KEYS.map((permissionKey) => ({
      user_id: userId,
      permission_key: permissionKey,
      granted: grants.has(permissionKey),
    }))
    const { error: permissionError } = await supabaseAdmin
      .from("permissions")
      .upsert(rows, { onConflict: "user_id,permission_key" })
    if (permissionError) {
      // The user exists and is usable; they just start with no grants. Log it
      // rather than rolling back an otherwise-successful creation.
      console.error("[create-user] Failed to seed starting permissions", {
        userId,
        templateId,
        error: permissionError,
      })
    }
  }

  try {
    await ensureUserTelephonyCredential(userId)
  } catch (telephonyError) {
    console.error("[create-user] Failed to provision Telnyx credential", telephonyError)
  }

  const orgName = await resolveOrgName(ctx.orgId)
  let inviteUrl: string | undefined
  let result: { sent: boolean; error?: string }

  if (method === "invite") {
    if (!hashedToken) {
      console.error("[create-user] generateLink returned no hashed_token", { email })
      result = { sent: false, error: "Supabase did not return an invite token." }
    } else {
      // Our own URL rather than data.properties.action_link, so the flow does
      // not depend on Supabase's redirect allow-list or the browser client's
      // auth flow (PKCE vs implicit).
      inviteUrl = `${APP_URL}/set-password?token_hash=${encodeURIComponent(hashedToken)}&type=invite`
      const { data: inviter } = await supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("id", ctx.userId)
        .maybeSingle()
      result = await sendInviteEmail({
        to: email,
        inviteUrl,
        orgName,
        inviterName: inviter?.display_name ?? null,
      })
    }
  } else {
    result = await sendAccountReadyEmail({
      to: email,
      orgName,
      signInUrl: `${APP_URL}/login`,
    })
  }

  return NextResponse.json({
    ok: true,
    user: { id: userId, email },
    emailSent: result.sent,
    // The link only ever ships in the response when the email did not — that is
    // the admin's fallback for hand-delivery, not a routine payload.
    ...(result.sent ? {} : { emailError: result.error }),
    ...(!result.sent && inviteUrl ? { inviteUrl } : {}),
  })
}
