// lib/supabase/index.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createBrowserSupabaseClient } from "@supabase/auth-helpers-nextjs"

/**
 * Browser client (read-only, anon key)
 * These MUST come from NEXT_PUBLIC_* so they get injected into the client bundle.
 */
const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLIC_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!PUBLIC_URL) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
if (!PUBLIC_ANON) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY")

const isBrowser = typeof window !== "undefined"

const createAnonClient = (): SupabaseClient => {
  if (isBrowser) {
    return createBrowserSupabaseClient({
      supabaseUrl: PUBLIC_URL,
      supabaseKey: PUBLIC_ANON,
    })
  }

  return createClient(PUBLIC_URL, PUBLIC_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const supabase: SupabaseClient = createAnonClient()

/**
 * Server admin client (service role) – never shipped to the browser.
 */
export const supabaseAdmin: SupabaseClient | null =
  typeof window === "undefined" && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(PUBLIC_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null
