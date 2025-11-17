import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  try {
    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      ADMIN_SEED_TOKEN,
    } = process.env

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_SEED_TOKEN) {
      return NextResponse.json({ ok: false, error: "Missing envs" }, { status: 500 })
    }

    const url = new URL(req.url)
    const token = url.searchParams.get("token") || req.headers.get("x-seed-token")
    if (token !== ADMIN_SEED_TOKEN) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const email = (url.searchParams.get("email") || "").trim().toLowerCase()
    const password = url.searchParams.get("password") || ""
    const name = url.searchParams.get("name") || ""
    const role = (url.searchParams.get("role") || "user").toLowerCase()

    if (!email) return NextResponse.json({ ok: false, error: "email required" }, { status: 400 })
    if (!password) return NextResponse.json({ ok: false, error: "password required" }, { status: 400 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    async function findUserByEmail(em: string) {
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
      if (error) throw error
      return data.users?.find((u) => (u.email || "").toLowerCase() === em.toLowerCase()) || null
    }

    let user = await findUserByEmail(email)

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: name ? { name } : undefined,
      })
      if (error) return NextResponse.json({ ok: false, error: String(error.message || error) }, { status: 500 })
      user = data.user
    } else {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        password,
        user_metadata: name ? { ...(user.user_metadata || {}), name } : user.user_metadata,
      })
      if (error) return NextResponse.json({ ok: false, error: String(error.message || error) }, { status: 500 })
    }

    const { error: upsertErr } = await supabase
      .from("profiles")
      .upsert(
        { id: user.id, email, name: name || user.user_metadata?.name || null, full_name: name || null, role },
        { onConflict: "id" }
      )
    if (upsertErr) return NextResponse.json({ ok: false, error: String(upsertErr.message || upsertErr) }, { status: 500 })

    return NextResponse.json({ ok: true, email, userId: user.id, role })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 })
  }
}

