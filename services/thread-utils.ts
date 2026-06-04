import { supabase } from "@/lib/supabase"

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

  // Find an existing anon thread for this number, scoped to the org when known.
  const selectExisting = async () => {
    let query = supabase
      .from("message_threads")
      .select("*")
      .eq("phone_number", phone_number)
      .is("buyer_id", null)
    if (orgId != null) {
      query = query.eq("org_id", orgId)
    }
    return await query.limit(1).maybeSingle()
  }

  const { data: existing } = await selectExisting()

  if (existing) {
    const { data, error } = await supabase
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
    org_id: orgId ?? null,
  }
  if (preferredFrom !== undefined) {
    insertFields.preferred_from_number = preferredFrom
  }

  const insertRes = await supabase
    .from("message_threads")
    .insert(insertFields)
    .select("*")
    .single()

  // Resilient to the partial unique index (org_id, phone_number) WHERE buyer_id IS NULL:
  // a concurrent insert races us, so re-select the now-existing row and update it.
  if (insertRes.error && (insertRes.error as { code?: string }).code === "23505") {
    const { data: raced } = await selectExisting()
    if (raced) {
      const { data, error } = await supabase
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
