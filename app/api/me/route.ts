export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { supabaseAdmin } from "@/lib/supabase"

const PROFILE_SELECT = "id,email,full_name,display_name,phone,role,org_id,sip_username"
const PROFILE_UPDATE_FIELDS = ["full_name", "display_name", "phone"] as const

type ProfileUpdateField = (typeof PROFILE_UPDATE_FIELDS)[number]

function pickProfileUpdates(body: unknown) {
  const updates: Partial<Record<ProfileUpdateField, string | null>> = {}
  if (!body || typeof body !== "object") return updates

  const source = body as Record<string, unknown>
  for (const field of PROFILE_UPDATE_FIELDS) {
    if (field in source) {
      const value = source[field]
      updates[field] = typeof value === "string" ? value : null
    }
  }

  return updates
}

async function getAuthenticatedUser() {
  const cookieStore = cookies()
  const routeClient = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await routeClient.auth.getUser()

  return user ?? null
}

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    )
  }

  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  return NextResponse.json(profile)
}

export async function PATCH(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    )
  }

  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const updates = pickProfileUpdates(body)

  const query = Object.keys(updates).length
    ? supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select(PROFILE_SELECT)
        .maybeSingle()
    : supabaseAdmin
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", user.id)
        .maybeSingle()

  const { data: profile, error } = await query

  if (error) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  return NextResponse.json(profile)
}
