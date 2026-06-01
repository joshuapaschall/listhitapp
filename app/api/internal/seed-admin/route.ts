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
    const adminName = ADMIN_NAME ?? "Admin User"
    const orgName = ADMIN_NAME ?? "Default Organization"

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
        user_metadata: { name: adminName },
      })
      if (error) throw error
      user = data.user
    }

    let orgId: string | null = null
    const { data: existingOrg, error: existingOrgErr } = await supabase
      .from("organizations")
      .select("id")
      .limit(1)
      .maybeSingle()
    if (existingOrgErr) throw existingOrgErr

    if (existingOrg?.id) {
      orgId = existingOrg.id
    } else {
      const { data: createdOrg, error: createOrgErr } = await supabase
        .from("organizations")
        .insert({ name: orgName })
        .select("id")
        .single()
      if (createOrgErr) throw createOrgErr
      orgId = createdOrg.id
    }

    // Ensure profile row
    const { error: upsertErr } = await supabase
      .from("profiles")
      .upsert(
        { id: user.id, email: ADMIN_EMAIL, name: adminName, role: "owner", org_id: orgId },
        { onConflict: "id" }
      )
    if (upsertErr) throw upsertErr

    const { error: ownerErr } = await supabase
      .from("organizations")
      .update({ owner_id: user.id })
      .eq("id", orgId)
      .is("owner_id", null)
    if (ownerErr) throw ownerErr

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
