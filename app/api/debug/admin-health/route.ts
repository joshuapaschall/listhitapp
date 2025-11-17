import { NextResponse } from "next/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

export async function GET() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    )
  }
  const admin = createAdmin(url, key)
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, totalKnown: data?.users?.length ?? 0 })
}
