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

export type TemplateType = "sms" | "email" | "quick_reply"
export type TemplateKind = "template" | "snippet"

export interface TemplateRecord {
  id: string
  name: string
  message: string
  subject?: string | null
  created_by?: string | null
  template_kind?: TemplateKind | null
  created_at?: string
  updated_at?: string
}

export interface Buyer {
  id: string
  fname?: string | null
  lname?: string | null
  full_name?: string | null
  email?: string | null
  phone?: string | null
  phone2?: string | null
  phone3?: string | null
  company?: string | null
  score?: number | null
  notes?: string | null
  mailing_address?: string | null
  mailing_city?: string | null
  mailing_state?: string | null
  mailing_zip?: string | null
  locations?: string[] | null
  tags?: string[] | null
  vip?: boolean | null
  vetted?: boolean | null
  can_receive_email?: boolean | null
  can_receive_sms?: boolean | null
  property_type?: string[] | null
  asking_price_min?: number | null
  asking_price_max?: number | null
  timeline?: string | null
  source?: string | null
  status?: string | null
  created_at?: string
  sendfox_hidden?: boolean | null
}

export interface Tag {
  id: string
  label: string
  color?: string | null
}

export interface Group {
  id: string
  name: string
}
