import { supabaseAdmin } from "@/lib/supabase"

export async function upsertAnonThread(
  phone_number: string,
  preferredFrom?: string | null,
  orgId?: string | null,
) {
  const updateFields: Record<string, any> = {
    unread: true,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  }
  if (preferredFrom !== undefined) {
    updateFields.preferred_from_number = preferredFrom
  }

  // The anon-thread unique index is (org_id, phone_number) WHERE buyer_id IS NULL,
  // so every read and write here must be org-scoped. supabaseAdmin bypasses RLS,
  // which makes an unscoped lookup a cross-tenant read — never allow one.
  const effectiveOrgId = orgId ?? process.env.DEFAULT_ORG_ID ?? null
  if (!effectiveOrgId) {
    console.error("[thread-utils] upsertAnonThread: no org resolved — refusing to touch message_threads", {
      phone_number,
    })
    return {
      data: null,
      error: { message: "upsertAnonThread: unresolved org", code: "ORG_UNRESOLVED" } as any,
    }
  }

  // Find an existing anon thread for this number, always scoped to the org.
  const selectExisting = async () => {
    return await supabaseAdmin
      .from("message_threads")
      .select("*")
      .eq("phone_number", phone_number)
      .is("buyer_id", null)
      .eq("org_id", effectiveOrgId)
      .limit(1)
      .maybeSingle()
  }

  const { data: existing } = await selectExisting()

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("message_threads")
      .update(updateFields)
      .eq("id", existing.id)
      .select("*")
      .single()
    return { data, error }
  }

  const insertFields: Record<string, any> = {
    buyer_id: null,
    phone_number,
    campaign_id: null,
    unread: true,
    updated_at: new Date().toISOString(),
    deleted_at: null,
    org_id: effectiveOrgId,
  }
  if (preferredFrom !== undefined) {
    insertFields.preferred_from_number = preferredFrom
  }

  const insertRes = await supabaseAdmin
    .from("message_threads")
    .insert(insertFields)
    .select("*")
    .single()

  // Resilient to the partial unique index (org_id, phone_number) WHERE buyer_id IS NULL:
  // a concurrent insert races us, so re-select the now-existing row and update it.
  if (insertRes.error && (insertRes.error as { code?: string }).code === "23505") {
    const { data: raced } = await selectExisting()
    if (raced) {
      const { data, error } = await supabaseAdmin
        .from("message_threads")
        .update(updateFields)
        .eq("id", raced.id)
        .select("*")
        .single()
      return { data, error }
    }
  }

  return insertRes
}
