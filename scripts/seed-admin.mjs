// scripts/seed-admin.mjs
// Usage: node scripts/seed-admin.mjs
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME(optional)

import { createClient } from "@supabase/supabase-js"

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME = "Admin User",
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
      user_metadata: { name: ADMIN_NAME },
    })
    if (error && !String(error.message || "").match(/already/i)) {
      throw error
    }
    userId = data?.user?.id || (await getUserIdByEmail(ADMIN_EMAIL))
  }

  if (!userId) throw new Error("Could not resolve admin user id")

  // Ensure profiles row exists and is admin
  // NOTE: adjust table/columns if your schema differs
  const { error: upsertErr } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, email: ADMIN_EMAIL, name: ADMIN_NAME, role: "admin" },
      { onConflict: "id" },
    )
  if (upsertErr) throw upsertErr

  console.log(`✅ Admin ready: ${ADMIN_EMAIL} (id=${userId})`)
}

ensureAdminUser().catch((err) => {
  console.error("❌ Seed admin failed:", err)
  process.exit(1)
})
