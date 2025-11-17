import { NextResponse } from "next/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase() || ""
  if (!email) {
    return NextResponse.json({ ok: false, error: "email required" }, { status: 400 })
  }
  const admin = createAdmin(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  const match = data.users.find((u) => (u.email || "").toLowerCase() === email)
  return NextResponse.json({
    ok: true,
    exists: !!match,
    user: match ? { id: match.id, email: match.email } : null,
  })
}
