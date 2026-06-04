import { supabaseAdmin } from "@/lib/supabase"
import type { Buyer } from "@/lib/supabase"
import { normalizePhone } from "@/lib/dedup-utils"
import { suppressBuyerSms } from "@/lib/sms/suppress"
import { suppressBuyerEmail } from "@/lib/email/suppress"
import { recordDncPhone } from "@/lib/dnc/phones"

export interface DncChannels {
  sms?: boolean
  email?: boolean
  calls?: boolean
}

// A buyer is on the DNC list when ANY of these opt-out signals is set.
const OPTOUT_OR =
  "sms_suppressed.eq.true,email_suppressed.eq.true,is_unsubscribed.eq.true,blocked_at.not.is.null,can_receive_sms.eq.false,can_receive_email.eq.false"

const DNC_COLUMNS =
  "id, fname, lname, full_name, email, phone, can_receive_sms, can_receive_email, can_receive_calls, sms_suppressed, sms_suppressed_at, sms_suppressed_reason, email_suppressed, email_suppressed_at, email_suppressed_reason, is_unsubscribed, unsubscribed_at, blocked_at, blocked_reason"

/**
 * Add a buyer to the DNC list. Suppresses OUTBOUND on the chosen channels only.
 * NEVER sets blocked_at — DNC ≠ Block (inbound must keep flowing). Every direct
 * buyers query is org-scoped.
 */
export async function addBuyerToDnc(
  orgId: string,
  buyerId: string,
  channels: DncChannels,
  reason: string,
): Promise<void> {
  if (!orgId || !buyerId) return

  // Verify the buyer belongs to this org (and grab the phone for the blocklist).
  const { data: buyer } = await supabaseAdmin
    .from("buyers")
    .select("id, phone")
    .eq("id", buyerId)
    .eq("org_id", orgId)
    .maybeSingle()
  if (!buyer) return

  const why = reason || "manual_dnc"

  if (channels.sms) {
    await suppressBuyerSms(buyerId, why)
    await recordDncPhone(supabaseAdmin, orgId, (buyer as any).phone, "manual", why)
  }
  if (channels.email) {
    await suppressBuyerEmail(buyerId, why)
  }
  if (channels.calls) {
    await supabaseAdmin
      .from("buyers")
      .update({ can_receive_calls: false })
      .eq("id", buyerId)
      .eq("org_id", orgId)
  }
}

/**
 * Re-enable the selected channels for a buyer. Does NOT touch blocked_at.
 */
export async function removeBuyerFromDnc(
  orgId: string,
  buyerId: string,
  channels: DncChannels,
): Promise<void> {
  if (!orgId || !buyerId) return

  const updates: Record<string, unknown> = {}
  if (channels.sms) {
    updates.can_receive_sms = true
    updates.sms_suppressed = false
    updates.sms_suppressed_at = null
    updates.sms_suppressed_reason = null
  }
  if (channels.email) {
    updates.can_receive_email = true
    updates.email_suppressed = false
    updates.email_suppressed_at = null
    updates.email_suppressed_reason = null
    updates.is_unsubscribed = false
    updates.unsubscribed_at = null
  }
  if (channels.calls) {
    updates.can_receive_calls = true
  }

  if (Object.keys(updates).length) {
    await supabaseAdmin.from("buyers").update(updates).eq("id", buyerId).eq("org_id", orgId)
  }

  // When re-enabling SMS, also clear the buyer's number from the phone blocklist
  // so a future import doesn't silently re-suppress them.
  if (channels.sms) {
    const { data: buyer } = await supabaseAdmin
      .from("buyers")
      .select("phone")
      .eq("id", buyerId)
      .eq("org_id", orgId)
      .maybeSingle()
    const normalized = normalizePhone((buyer as any)?.phone)
    if (normalized) {
      await supabaseAdmin
        .from("dnc_phones")
        .delete()
        .eq("org_id", orgId)
        .eq("normalized_phone", normalized)
    }
  }
}

/**
 * Add a raw phone number (no buyer record) to the DNC blocklist.
 */
export async function addRawPhoneToDnc(orgId: string, rawPhone: string, reason: string): Promise<void> {
  await recordDncPhone(supabaseAdmin, orgId, rawPhone, "manual", reason || "manual_dnc")
}

/**
 * Best-effort human label for why a buyer is on the DNC list.
 */
export function deriveDncSource(buyer: Partial<Buyer>): string {
  if (buyer.blocked_at) return "Blocked"
  const reason = (buyer.sms_suppressed_reason || buyer.email_suppressed_reason || "").toLowerCase()
  if (reason.startsWith("keyword:")) return "Keyword"
  if (reason.includes("stop")) return "STOP reply"
  if (buyer.is_unsubscribed) return "Unsubscribed"
  return "Manual"
}

export interface DncListResult {
  rows: Buyer[]
  total: number
  page: number
  pageSize: number
  stats: { total: number; smsOut: number; emailUnsub: number; blocked: number }
}

/**
 * List opted-out buyers for an org with search + pagination + stat counts.
 * Reads buyer suppression columns (the source of truth) — org-scoped.
 */
export async function listDnc(
  orgId: string,
  opts: { search?: string; page?: number; pageSize?: number } = {},
): Promise<DncListResult> {
  const page = Math.max(1, opts.page || 1)
  const pageSize = Math.min(200, Math.max(1, opts.pageSize || 25))
  const search = (opts.search || "").trim()

  let rowsQuery = supabaseAdmin
    .from("buyers")
    .select(DNC_COLUMNS, { count: "exact" })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .or(OPTOUT_OR)

  if (search) {
    const q = encodeURIComponent(search)
    rowsQuery = rowsQuery.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
  }

  rowsQuery = rowsQuery
    .order("updated_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count, error } = await rowsQuery
  if (error) throw error

  // Org-wide stat counts (independent of the search box).
  const base = () =>
    supabaseAdmin
      .from("buyers")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("deleted_at", null)

  const [totalRes, smsRes, emailRes, blockedRes] = await Promise.all([
    base().or(OPTOUT_OR),
    base().or("sms_suppressed.eq.true,can_receive_sms.eq.false"),
    base().or("is_unsubscribed.eq.true,email_suppressed.eq.true,can_receive_email.eq.false"),
    base().not("blocked_at", "is", null),
  ])

  return {
    rows: (data || []) as unknown as Buyer[],
    total: count || 0,
    page,
    pageSize,
    stats: {
      total: totalRes.count || 0,
      smsOut: smsRes.count || 0,
      emailUnsub: emailRes.count || 0,
      blocked: blockedRes.count || 0,
    },
  }
}
