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
export const supabaseAdmin: SupabaseClient =
  typeof window === "undefined"
    ? createClient(PUBLIC_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || PUBLIC_ANON, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : createAnonClient()

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
  website?: string | null
  property_interest?: string | null
  year_built_min?: number | null
  year_built_max?: number | null
  sqft_min?: number | null
  sqft_max?: number | null
  beds_min?: number | null
  baths_min?: number | null
  min_arv?: number | null
  min_arv_percent?: number | null
  min_gross_margin?: number | null
  max_gross_margin?: number | null
  down_payment_min?: number | null
  down_payment_max?: number | null
  monthly_payment_min?: number | null
  monthly_payment_max?: number | null
  cash_buyer?: boolean | null
  investor?: boolean | null
  owner_financing?: boolean | null
  first_time_buyer?: boolean | null
  can_receive_calls?: boolean | null
  deleted_at?: string | null
  updated_at?: string
  sendfox_contact_id?: number | null
  sendfox_suppressed?: boolean | null
  sendfox_bounced_at?: string | null
  sendfox_complained_at?: string | null
  sendfox_double_opt_in?: boolean | null
  sendfox_double_opt_in_at?: string | null
}

export interface Tag {
  id: string
  name: string
  color: string
  is_protected?: boolean
  usage_count?: number
  created_at?: string
}

export interface Group {
  id: string
  name: string
  slug?: string | null
  description?: string | null
  type?: string
  criteria?: Record<string, unknown> | null
  color?: string | null
  sendfox_list_id?: number | null
  created_at?: string
  updated_at?: string
}

export interface Property {
  id: string
  address?: string
  city?: string | null
  state?: string | null
  zip?: string | null
  latitude?: number | null
  longitude?: number | null
  price?: number | null
  down_payment?: number | null
  monthly_payment?: number | null
  earnest_money?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  sqft?: number | null
  description?: string | null
  property_type?: string | null
  disposition_strategy?: string | null
  buyer_fit?: string | null
  condition?: string | null
  occupancy?: string | null
  priority?: string | null
  tags?: string[] | null
  video_link?: string | null
  short_url_key?: string | null
  short_url?: string | null
  short_slug?: string | null
  shortio_link_id?: string | null
  website_url?: string | null
  status?: string
  created_at?: string
  updated_at?: string
}

export interface PropertyImage {
  id: string
  property_id?: string
  image_url?: string
  sort_order?: number
  is_featured?: boolean | null
  created_at?: string
}

export interface PropertyBuyer {
  property_id: string
  buyer_id: string
}

export interface Offer {
  id: string
  buyer_id?: string | null
  property_id?: string | null
  offer_type?: string | null
  offer_price?: number | null
  down_payment?: number | null
  monthly_payment?: number | null
  earnest_money?: number | null
  status?: string
  notes?: string | null
  submitted_at?: string
  accepted_at?: string | null
  rejected_at?: string | null
  withdrawn_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface Showing {
  id: string
  property_id?: string | null
  buyer_id?: string | null
  scheduled_at?: string
  status?: string
  notes?: string | null
  created_by?: string | null
  reminder_sent?: boolean
  created_at?: string
  updated_at?: string
}

export interface Message {
  id: string
  thread_id?: string | null
  buyer_id?: string | null
  direction?: string
  from_number?: string | null
  to_number?: string | null
  body?: string | null
  provider_id?: string | null
  media_urls?: string[] | null
  is_bulk?: boolean
  filtered?: boolean
  created_at?: string
  deleted_at?: string | null
}

export interface MessageThread {
  id: string
  buyer_id?: string | null
  phone_number?: string
  preferred_from_number?: string | null
  campaign_id?: string | null
  starred?: boolean
  unread?: boolean
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export interface NegativeKeyword {
  id: string
  keyword: string
  created_at?: string
}

export interface AIPrompt {
  id: string
  name: string
  description?: string | null
  prompt: string
  created_at?: string
  updated_at?: string
}
