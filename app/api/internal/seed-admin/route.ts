import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

async function handler(req: NextRequest) {
  try {
    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      ADMIN_NAME,
      ADMIN_SEED_TOKEN,
    } = process.env

    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY ||
      !ADMIN_EMAIL ||
      !ADMIN_PASSWORD ||
      !ADMIN_NAME ||
      !ADMIN_SEED_TOKEN
    ) {
      return NextResponse.json(
        { ok: false, error: "Missing envs" },
        { status: 500 }
      )
    }

    const token =
      req.headers.get("x-seed-token") ?? req.nextUrl.searchParams.get("token")
    if (token !== ADMIN_SEED_TOKEN) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    // Lookup existing user
    const { data: list } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })
    let user =
      list?.users?.find(
        (u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      ) ?? null

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { name: ADMIN_NAME },
      })
      if (error) throw error
      user = data.user
    }

    // Ensure profile row
    const { error: upsertErr } = await supabase
      .from("profiles")
      .upsert(
        { id: user.id, email: ADMIN_EMAIL, name: ADMIN_NAME, role: "admin" },
        { onConflict: "id" }
      )
    if (upsertErr) throw upsertErr

    return NextResponse.json({
      ok: true,
      email: ADMIN_EMAIL,
      userId: user.id,
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    )
  }
}

export { handler as POST, handler as GET }
