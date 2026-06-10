import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import { upsertStepStatus } from "@/lib/onboarding/service"
import type { A2pAssembledState, A2pStatus } from "@/lib/a2p-registration/types"

const USE_CASE_LABEL = "Marketing — property alerts"

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function isNonEmpty(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0
}

// Mask all but the last 4 digits of an EIN → "••-•••5821". Empty when no EIN.
function maskEin(ein: string): string {
  const digits = ein.replace(/\D/g, "")
  if (!digits) return ""
  return `••-•••${digits.slice(-4)}`
}

function composeAddress(org: any): string {
  const cityState = [s(org?.city), s(org?.state)].filter(Boolean).join(", ")
  return [s(org?.address_line1), s(org?.address_line2), cityState, s(org?.zip)]
    .filter(Boolean)
    .join(", ")
}

function buildCampaignDescription(brandToken: string, website: string): string {
  return `This campaign sends text messages to people who joined the ${brandToken} property buyer list at ${website} and opted in — new off-market deals, investment opportunities, and list updates, plus replies to properties they ask about.`
}

function defaultSamples(brandToken: string): { sample1: string; sample2: string } {
  return {
    sample1: `${brandToken}: New off-market deal in [city] — [beds]bd/[baths]ba, asking [price]. Reply YES for details. Msg & data rates may apply. Reply STOP to opt out.`,
    sample2: `${brandToken}: Here's the info on [address] you asked about: [link]. Reply with any questions. Reply STOP to opt out.`,
  }
}

export async function getA2pState(orgId: string): Promise<A2pAssembledState> {
  const { data: ver } = await supabaseAdmin
    .from("business_verification")
    .select("legal_business_name, ein, dba_name, contact_first_name, contact_last_name, contact_email, status")
    .eq("org_id", orgId)
    .maybeSingle()

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("business_name, address_line1, address_line2, city, state, zip, phone, website_url")
    .eq("id", orgId)
    .maybeSingle()

  const { data: row } = await supabaseAdmin
    .from("a2p_registration")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle()

  const legalName = s(ver?.legal_business_name)
  const dba = s(ver?.dba_name)
  const businessName = s(org?.business_name)
  const website = s(org?.website_url)

  const brandToken = dba || businessName || legalName || "your business"
  const legalDisplay =
    dba && dba !== legalName ? `${legalName} DBA ${dba}` : legalName || businessName

  const contactName = [s(ver?.contact_first_name), s(ver?.contact_last_name)].filter(Boolean).join(" ")

  const storedSamples = isNonEmpty(row?.sample_message_1) || isNonEmpty(row?.sample_message_2)
  const samples = storedSamples
    ? { sample1: s(row?.sample_message_1), sample2: s(row?.sample_message_2) }
    : defaultSamples(brandToken)

  return {
    brand: {
      legalDisplay,
      einMasked: maskEin(s(ver?.ein)),
      address: composeAddress(org),
      contactName,
      contactEmail: s(ver?.contact_email),
      phone: s(org?.phone),
    },
    program: {
      useCaseLabel: USE_CASE_LABEL,
      campaignDescription: buildCampaignDescription(brandToken, website || "your website"),
      optInUrl: website,
    },
    samples,
    status: (row?.status as A2pStatus) ?? "draft",
    ready: {
      verifyReady: ver?.status === "ready",
      websiteSet: isNonEmpty(website),
    },
  }
}

export interface SaveResult {
  ok: boolean
  error?: string
  state?: A2pAssembledState
}

export async function saveA2p(orgId: string, payload: unknown): Promise<SaveResult> {
  const body = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>

  const sample1 = s(body.sample_message_1)
  const sample2 = s(body.sample_message_2)

  // Recompute the brand-derived program copy server-side (never trust the client
  // for these — they're assembled from our own records).
  const { data: ver } = await supabaseAdmin
    .from("business_verification")
    .select("legal_business_name, dba_name")
    .eq("org_id", orgId)
    .maybeSingle()
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("business_name, website_url")
    .eq("id", orgId)
    .maybeSingle()

  const brandToken =
    s(ver?.dba_name) || s(org?.business_name) || s(ver?.legal_business_name) || "your business"
  const website = s(org?.website_url)
  const campaignDescription = buildCampaignDescription(brandToken, website || "your website")

  const status: A2pStatus = isNonEmpty(sample1) && isNonEmpty(sample2) ? "ready" : "draft"

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin.from("a2p_registration").upsert(
    {
      org_id: orgId,
      use_case: "marketing",
      campaign_description: campaignDescription,
      sample_message_1: sample1 || null,
      sample_message_2: sample2 || null,
      opt_in_url: website || null,
      status,
      updated_at: now,
    },
    { onConflict: "org_id" },
  )
  if (error) return { ok: false, error: error.message }

  await upsertStepStatus(orgId, "a2p_registration", "in_progress")
  if (status === "ready") await upsertStepStatus(orgId, "a2p_registration", "done")

  const state = await getA2pState(orgId)
  return { ok: true, state }
}
