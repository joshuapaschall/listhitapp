// Self-serve org creation. This is the one place a profile legitimately gains an
// org_id and the owner role, so every write goes through supabaseAdmin: the RLS
// policies and the profiles_block_privileged_self_update trigger deliberately
// stop the end user from doing any of this themselves.

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { supabaseAdmin } from "@/lib/supabase"
import { SYSTEM_TAGS } from "@/lib/tags/system-tags"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COMPANY_MIN = 2
const COMPANY_MAX = 120
const NAME_MAX = 120

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("id, org_id, role, must_change_password")
    .eq("id", user.id)
    .maybeSingle()

  if (profileErr) {
    console.error("[create-org] profile lookup failed", { userId: user.id, error: profileErr })
    return NextResponse.json({ error: "Could not load your profile" }, { status: 500 })
  }

  // Idempotent: double clicks and invited teammates (who already belong to an
  // org) get the same success answer instead of a second organization.
  if (profile?.org_id) {
    return NextResponse.json({ ok: true, orgId: profile.org_id, created: false }, { status: 200 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    companyName?: unknown
    name?: unknown
  }
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""

  if (companyName.length < COMPANY_MIN || companyName.length > COMPANY_MAX) {
    return NextResponse.json(
      { error: `Company name must be between ${COMPANY_MIN} and ${COMPANY_MAX} characters.` },
      { status: 400 },
    )
  }
  if (name.length < 1 || name.length > NAME_MAX) {
    return NextResponse.json(
      { error: `Your name must be between 1 and ${NAME_MAX} characters.` },
      { status: 400 },
    )
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .insert({ name: companyName, business_name: companyName, owner_id: user.id })
    .select("id")
    .single()

  if (orgErr || !org?.id) {
    console.error("[create-org] organization insert failed", { userId: user.id, error: orgErr })
    return NextResponse.json({ error: "Could not create your workspace" }, { status: 500 })
  }

  // The system tags are names the application code hard-codes, so a brand-new
  // org has to have them before anyone can use the app. Same rollback as the
  // profile-claim failure below: an org without its vocabulary is worse than no
  // org at all.
  const { error: tagSeedErr } = await supabaseAdmin
    .from("tags")
    .insert(SYSTEM_TAGS.map((name) => ({ org_id: org.id, name, is_protected: true })))

  if (tagSeedErr) {
    console.error("[create-org] system tag seed failed — rolling back org", {
      userId: user.id,
      orgId: org.id,
      error: tagSeedErr,
    })
    await supabaseAdmin.from("organizations").delete().eq("id", org.id)
    return NextResponse.json({ error: "Could not create your workspace" }, { status: 500 })
  }

  // .is("org_id", null) makes this a compare-and-set: if a concurrent request
  // (or an invite accepted in another tab) already assigned an org, we must not
  // clobber it — we roll our own org back instead.
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("profiles")
    .update({
      org_id: org.id,
      role: "owner",
      full_name: name,
      display_name: name,
    })
    .eq("id", user.id)
    .is("org_id", null)
    .select("id")

  if (updateErr || !updated?.length) {
    console.error("[create-org] profile claim failed — rolling back org", {
      userId: user.id,
      orgId: org.id,
      error: updateErr,
    })
    await supabaseAdmin.from("organizations").delete().eq("id", org.id)
    return NextResponse.json(
      { error: "Your account was already assigned to an organization. Refresh the page." },
      { status: 409 },
    )
  }

  return NextResponse.json({ ok: true, orgId: org.id, created: true }, { status: 201 })
}
