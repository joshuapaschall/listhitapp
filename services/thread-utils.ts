import { supabase } from "@/lib/supabase"

export async function upsertAnonThread(
  phone_number: string,
  preferredFrom?: string | null,
) {
  const updateFields: Record<string, any> = {
    unread: true,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  }
  if (preferredFrom !== undefined) {
    updateFields.preferred_from_number = preferredFrom
  }

  const { data: existing } = await supabase
    .from("message_threads")
    .select("*")
    .eq("phone_number", phone_number)
    .is("buyer_id", null)
    .limit(1)
    .maybeSingle()

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
  }
  if (preferredFrom !== undefined) {
    insertFields.preferred_from_number = preferredFrom
  }

  return await supabase
    .from("message_threads")
    .insert(insertFields)
    .select("*")
    .single()
}
