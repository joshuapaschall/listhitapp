// scripts/seed-admin.mjs
// Usage: node scripts/seed-admin.mjs
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME(optional)

import { createClient } from "@supabase/supabase-js"

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME,
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD",
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const adminName = ADMIN_NAME ?? "Admin User"
const orgName = ADMIN_NAME ?? "Default Organization"

// best-effort lookup by email via listUsers (Supabase JS v2)
async function getUserIdByEmail(email) {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) throw error
    const user = data.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    return user?.id || null
  } catch (e) {
    return null // continue; we'll try to create
  }
}

async function ensureAdminUser() {
  let userId = await getUserIdByEmail(ADMIN_EMAIL)

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { name: adminName },
    })
    if (error && !String(error.message || "").match(/already/i)) {
      throw error
    }
    userId = data?.user?.id || (await getUserIdByEmail(ADMIN_EMAIL))
  }

  if (!userId) throw new Error("Could not resolve admin user id")

  let orgId = null
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

  // Ensure profiles row exists and is owner
  // NOTE: adjust table/columns if your schema differs
  const { error: upsertErr } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, email: ADMIN_EMAIL, name: adminName, role: "owner", org_id: orgId },
      { onConflict: "id" },
    )
  if (upsertErr) throw upsertErr

  const { error: ownerErr } = await supabase
    .from("organizations")
    .update({ owner_id: userId })
    .eq("id", orgId)
    .is("owner_id", null)
  if (ownerErr) throw ownerErr

  console.log(`✅ Admin owner ready: ${ADMIN_EMAIL} (id=${userId}, org=${orgId})`)
}

ensureAdminUser().catch((err) => {
  console.error("❌ Seed admin failed:", err)
  process.exit(1)
})
