import type { SupabaseClient } from "@supabase/supabase-js"
import { createBrowserSupabaseClient } from "@supabase/auth-helpers-nextjs"

let browserClient: SupabaseClient | null = null

export function supabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
    }

    if (!anonKey) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY")
    }

    browserClient = createBrowserSupabaseClient({
      supabaseUrl,
      supabaseKey: anonKey,
    })
  }

  return browserClient
}
