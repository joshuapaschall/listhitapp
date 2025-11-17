export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import crypto from "node:crypto"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient as createAdmin } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { getSipCredentialConnectionId, getTelnyxApiKey } from "@/lib/voice-env"
import { SIP_CONNECTION_INVALID_MESSAGE } from "@/lib/telnyx/credentials"

const CreateAgent = z
  .object({
    email: z.string().email(),
    displayName: z.string().min(1, "Display name required").optional(),
    display_name: z.string().min(1, "Display name required").optional(),
    sipUsername: z.string().regex(/^[a-z0-9_.-]{3,}$/i).optional(),
    sip_username: z.string().regex(/^[a-z0-9_.-]{3,}$/i).optional(),
    password: z.string().min(6, "Password too short"),
  })
  .transform((value) => ({
    email: value.email.trim().toLowerCase(),
    display_name: (value.display_name ?? value.displayName ?? "").trim() || null,
    sip_username: (value.sip_username ?? value.sipUsername ?? "").trim() || undefined,
    password: value.password,
  }))

type TelnyxCredentialResponse = {
  data?: { id?: string; username?: string }
  errors?: Array<{ detail?: string; message?: string }>
}

type TelnyxCredentialResult = {
  ok: boolean
  status: number
  json: TelnyxCredentialResponse | Record<string, any>
}

async function deleteTelnyxCredential(id: string) {
  const apiKey = getTelnyxApiKey()
  if (!apiKey || !id) return
  try {
    await fetch(`${TELNYX_API_URL}/telephony_credentials/${id}`, {
      method: "DELETE",
      headers: telnyxHeaders(),
    })
  } catch (error) {
    console.error("Failed to delete Telnyx credential", error)
  }
}

function genSipUsername() {
  return `sip_${Date.now().toString().slice(-6)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

async function createTelnyxCredential(
  connectionId: string,
  username: string,
  password: string,
): Promise<TelnyxCredentialResult> {
  const resp = await fetch(`${TELNYX_API_URL}/telephony_credentials`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({ connection_id: connectionId }),
  })
  const json = ((await resp.json().catch(() => ({}))) as TelnyxCredentialResponse) || {}

  if (!resp.ok) {
    const message = extractTelnyxMessage(json)
    const normalized =
      typeof message === "string"
        ? message.toLowerCase()
        : JSON.stringify(message).toLowerCase()

    if (
      normalized.includes("connection") &&
      (normalized.includes("invalid") ||
        normalized.includes("credential connection") ||
        normalized.includes("sip credential"))
    ) {
      const errors = Array.isArray(json?.errors) ? json.errors : []
      return {
        ok: false,
        status: 400,
        json: {
          ...json,
          errors: [
            { detail: SIP_CONNECTION_INVALID_MESSAGE },
            ...(errors as Array<{ detail?: string; message?: string }>),
          ],
        },
      }
    }
  }

  return { ok: resp.ok, status: resp.status, json }
}

function extractTelnyxMessage(payload: TelnyxCredentialResponse | Record<string, any>) {
  return (
    payload?.errors?.[0]?.detail ||
    payload?.errors?.[0]?.message ||
    (payload as any)?.error ||
    JSON.stringify(payload)
  )
}

async function findSupabaseAuthUserId(
  admin: SupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
): Promise<string | null> {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return null

  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const match = data?.users?.find(
      (user) => (user.email || "").toLowerCase() === normalizedEmail,
    )
    if (match?.id) return match.id
  } catch (error) {
    console.error("Failed to list Supabase auth users", error)
  }

  try {
    const url = `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(normalizedEmail)}`
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    const raw = await resp.text().catch(() => "")
    if (!resp.ok || !raw) return null

    let json: any = null
    try {
      json = JSON.parse(raw)
    } catch (error) {
      console.error("Failed to parse Supabase admin user response", error, raw)
      return null
    }

    const candidates: Array<{ id?: string; email?: string }> = []
    if (Array.isArray(json)) {
      candidates.push(...json)
    } else if (Array.isArray(json?.users)) {
      candidates.push(...json.users)
    } else if (json?.id) {
      candidates.push(json)
    }

    for (const candidate of candidates) {
      if ((candidate.email || "").toLowerCase() === normalizedEmail && candidate.id) {
        return candidate.id
      }
    }
  } catch (error) {
    console.error("Failed to query Supabase auth admin by email", error)
  }

  return null
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sipCredentialConnectionId = getSipCredentialConnectionId()

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Server missing Supabase configuration" },
      { status: 503 },
    )
  }

  if (!sipCredentialConnectionId) {
    return NextResponse.json(
      { ok: false, error: "Missing SIP credential connection id" },
      { status: 500 },
    )
  }

  try {
    const admin = createAdmin(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const body = await req.json()
    const { email, display_name, sip_username, password } = CreateAgent.parse(body)
    const finalDisplayName = display_name || email

    const password_hash = bcrypt.hashSync(password, 10)
    const { data: existingAgent, error: existingAgentErr } = await admin
      .from("agents")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (existingAgentErr) {
      return NextResponse.json(
        { ok: false, error: existingAgentErr.message },
        { status: 500 },
      )
    }

    if (existingAgent) {
      return NextResponse.json(
        { ok: false, error: "Agent already exists for this email" },
        { status: 409 },
      )
    }

    let authUserId: string | null = null
    let createdSupabaseUser = false

    const {
      data: created,
      error: createErr,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createErr) {
      authUserId = await findSupabaseAuthUserId(admin, supabaseUrl, serviceRoleKey, email)

      if (!authUserId) {
        return NextResponse.json(
          { ok: false, error: createErr.message || "Supabase admin.createUser failed" },
          { status: 500 },
        )
      }
    } else if (created?.user?.id) {
      authUserId = created.user.id
      createdSupabaseUser = true
    }

    if (!authUserId) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase user id" },
        { status: 500 },
      )
    }

    const {
      data: agentRow,
      error: agentErr,
    } = await admin
      .from("agents")
      .insert({
        email,
        display_name: finalDisplayName,
        password_hash,
        auth_user_id: authUserId,
        sip_username: sip_username ?? null,
      })
      .select(
        "id, email, display_name, auth_user_id, sip_username, created_at",
      )
      .single()

    if (agentErr || !agentRow) {
      if (createdSupabaseUser) {
        try {
          await admin.auth.admin.deleteUser(authUserId)
        } catch (cleanupError) {
          console.error("Failed to delete Supabase auth user during rollback", cleanupError)
        }
      }
      const message = agentErr?.message?.toLowerCase?.() || ""
      if (message.includes("duplicate") || message.includes("unique")) {
        return NextResponse.json(
          { ok: false, error: "Agent already exists for this email" },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { ok: false, error: agentErr?.message || "Failed to create agent" },
        { status: 500 },
      )
    }

    const telnyxPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
    let desiredSipUsername = (sip_username || genSipUsername()).toLowerCase()

    let telnyxResult = await createTelnyxCredential(
      sipCredentialConnectionId,
      desiredSipUsername,
      telnyxPassword,
    )
    let telnyxMessage = extractTelnyxMessage(telnyxResult.json)

    if (
      !telnyxResult.ok &&
      telnyxResult.status === 422 &&
      typeof telnyxMessage === "string" &&
      telnyxMessage.toLowerCase().includes("username")
    ) {
      desiredSipUsername = genSipUsername()
      telnyxResult = await createTelnyxCredential(
        sipCredentialConnectionId,
        desiredSipUsername,
        telnyxPassword,
      )
      telnyxMessage = extractTelnyxMessage(telnyxResult.json)
    }

    if (!telnyxResult.ok) {
      {
        const { error: cleanupError } = await admin
          .from("agents")
          .delete()
          .eq("id", agentRow.id)
        if (cleanupError) {
          console.error("Failed to delete agent during rollback", cleanupError)
        }
      }
      if (createdSupabaseUser) {
        try {
          await admin.auth.admin.deleteUser(authUserId)
        } catch (cleanupError) {
          console.error("Failed to delete Supabase auth user during rollback", cleanupError)
        }
      }
      return NextResponse.json(
        { ok: false, error: `Telnyx: ${telnyxMessage}` },
        { status: telnyxResult.status || 500 },
      )
    }

    const credential = telnyxResult.json?.data

    if (!credential?.id) {
      {
        const { error: cleanupError } = await admin
          .from("agents")
          .delete()
          .eq("id", agentRow.id)
        if (cleanupError) {
          console.error("Failed to delete agent during rollback", cleanupError)
        }
      }
      if (createdSupabaseUser) {
        try {
          await admin.auth.admin.deleteUser(authUserId)
        } catch (cleanupError) {
          console.error("Failed to delete Supabase auth user during rollback", cleanupError)
        }
      }
      return NextResponse.json(
        {
          ok: false,
          error: `Telnyx: ${telnyxMessage}`,
        },
        { status: telnyxResult.status || 500 },
      )
    }
    
    const { data: updatedAgent, error: updateErr } = await admin
      .from("agents")
      .update({
        telnyx_credential_id: credential.id,
        sip_username: credential.sip_username || desiredSipUsername,
        sip_password: credential.sip_password ,
      })
      .eq("id", agentRow.id)
      .select(
        "id, email, display_name, auth_user_id, sip_username, created_at",
      )
      .single()

    if (updateErr || !updatedAgent) {
      await deleteTelnyxCredential(credential.id as string)
      if (createdSupabaseUser) {
        try {
          await admin.auth.admin.deleteUser(authUserId)
        } catch (cleanupError) {
          console.error("Failed to delete Supabase auth user during rollback", cleanupError)
        }
      }
      {
        const { error: cleanupError } = await admin
          .from("agents")
          .delete()
          .eq("id", agentRow.id)
        if (cleanupError) {
          console.error("Failed to delete agent during rollback", cleanupError)
        }
      }
      return NextResponse.json(
        { ok: false, error: updateErr?.message || "Failed to store SIP credentials" },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { ok: true, agent: updatedAgent },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    )
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", details: error.issues },
        { status: 400 },
      )
    }
    console.error("POST /api/agents/create failed:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error" },
      { status: 500 },
    )
  }
}
