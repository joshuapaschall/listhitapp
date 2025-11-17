import { supabase } from "@/lib/supabase"

export async function upsertAnonThread(phone_number: string) {
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
      .update({
        unread: true,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      })
      .eq("id", existing.id)
      .select("*")
      .single()
    return { data, error }
  }

  return await supabase
    .from("message_threads")
    .insert({
      buyer_id: null,
      phone_number,
      campaign_id: null,
      unread: true,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    })
    .select("*")
    .single()
}
