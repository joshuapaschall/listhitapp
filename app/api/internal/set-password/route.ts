import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const hdrToken = req.headers.get("x-seed-token")
  const qToken = searchParams.get("token") ?? ""
  const token = hdrToken || qToken

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_SEED_TOKEN,
  } = process.env

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_SEED_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Missing server envs" },
      { status: 500 }
    )
  }
  if (token !== ADMIN_SEED_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    )
  }

  const email = (searchParams.get("email") || "").trim().toLowerCase()
  const password = searchParams.get("password") || ""

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "email and password are required" },
      { status: 400 }
    )
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Find user by email (Supabase v2: list + filter)
  const { data: list, error: listErr } = await supa.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listErr) {
    return NextResponse.json(
      { ok: false, error: String(listErr.message || listErr) },
      { status: 500 }
    )
  }

  const user = list?.users?.find(
    (u) => (u.email || "").toLowerCase() === email
  )
  if (!user) {
    return NextResponse.json(
      { ok: false, error: `User not found: ${email}` },
      { status: 404 }
    )
  }

  const { error: updErr } = await supa.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  })
  if (updErr) {
    return NextResponse.json(
      { ok: false, error: String(updErr.message || updErr) },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, email, userId: user.id })
}

export const GET = handler
export const POST = handler

