import type { SupabaseClient } from "@supabase/supabase-js"

export async function getUserRole(client: SupabaseClient) {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return "user"
  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  return profile?.role || "user"
}
