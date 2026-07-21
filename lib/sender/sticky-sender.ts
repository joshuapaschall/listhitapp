import type { SupabaseClient } from "@supabase/supabase-js"
import { formatPhoneE164, normalizePhone } from "@/lib/dedup-utils"
import { pickPoolFromNumber } from "./campaign-from-pool"

interface ResolveArgs {
  client: SupabaseClient
  buyerId?: string | null
  threadId?: string | null
  explicitFrom?: string | null
  // Campaign context: when both are provided, cold recipients rotate the
  // selected campaign market's pool instead of falling back to the env DID.
  sendingMarketId?: string | null
  orgId?: string | null
}

interface RecordArgs {
  client: SupabaseClient
  buyerId?: string | null
  threadId?: string | null
  from: string
}

// Validate that a candidate number is one THIS ORG actually owns/operates.
// Org-scoped: mirrors the inline check in app/api/messages/send/route.ts but
// never validates a number against another tenant's inventory.
async function isOwnedNumber(
  client: SupabaseClient,
  orgId: string,
  digits: string | null,
  e164: string | null,
): Promise<boolean> {
  if (e164) {
    const { data: inbound, error } = await client
      .from("inbound_numbers")
      .select("e164")
      .eq("org_id", orgId)
      .eq("enabled", true)
      .in("e164", [e164])
    if (!error && inbound && inbound.length) return true
  }

  const matchValues = Array.from(
    new Set([digits, e164].filter((num): num is string => typeof num === "string")),
  )
  if (matchValues.length) {
    const { data: voice, error } = await client
      .from("voice_numbers")
      .select("phone_number")
      .eq("org_id", orgId)
      .in("phone_number", matchValues)
    if (!error && voice && voice.length) return true
  }

  return false
}

/**
 * Resolve the outbound from-number for an SMS. First match wins, each returned
 * normalized to E.164. Returns null only if nothing resolves.
 *
 *   1. explicitFrom — only when provided AND validated owned.
 *   2. thread.preferred_from_number
 *   3. newest inbound message's to_number on the thread
 *   4. buyer_sms_senders.from_number
 *   5a. campaign path (sendingMarketId + orgId): rotate the market's pool — no env fallback.
 *   5b. 1:1 / transactional path: process.env.DEFAULT_OUTBOUND_DID
 */
export async function resolveOutboundFrom({
  client,
  buyerId,
  threadId,
  explicitFrom,
  sendingMarketId,
  orgId,
}: ResolveArgs): Promise<string | null> {
  // 1. Explicit pick — honored only if we know the org AND the org owns it.
  //    SECURITY: with no orgId we cannot prove ownership, so we do NOT honor
  //    the explicit pick (fail closed) and fall through to sticky resolution.
  if (explicitFrom && orgId) {
    const digits = normalizePhone(explicitFrom)
    const e164 = formatPhoneE164(explicitFrom)
    if (digits && e164 && (await isOwnedNumber(client, orgId, digits, e164))) {
      return e164
    }
  }

  if (threadId) {
    // 2. Sticky on the thread.
    const { data: thread } = await client
      .from("message_threads")
      .select("preferred_from_number")
      .eq("id", threadId)
      .maybeSingle()
    const pref = formatPhoneE164(thread?.preferred_from_number)
    if (pref) return pref

    // 3. The DID the buyer last texted in to.
    const { data: lastIn } = await client
      .from("messages")
      .select("to_number")
      .eq("thread_id", threadId)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    const lastTo = formatPhoneE164(lastIn?.to_number)
    if (lastTo) return lastTo
  }

  // 4. Per-buyer sticky.
  if (buyerId) {
    const { data: sticky } = await client
      .from("buyer_sms_senders")
      .select("from_number")
      .eq("buyer_id", buyerId)
      .maybeSingle()
    const stuck = formatPhoneE164(sticky?.from_number)
    if (stuck) return stuck
  }

  // 5a. Campaign path: rotate the selected market's pool. No env fallback —
  // let NoSendingPoolError propagate so a blast never goes out a main line.
  if (sendingMarketId && orgId) {
    return pickPoolFromNumber(orgId, sendingMarketId)
  }

  // 5b. Env default — ONLY for 1:1 / transactional (no sendingMarketId).
  if (process.env.DEFAULT_OUTBOUND_DID) {
    const def = formatPhoneE164(process.env.DEFAULT_OUTBOUND_DID)
    if (def) return def
  }

  return null
}

/**
 * Record the sticky from-number across BOTH stores in lockstep. Best-effort:
 * never throws (a sticky write must not fail a successful send).
 */
export async function recordStickyFrom({
  client,
  buyerId,
  threadId,
  from,
}: RecordArgs): Promise<void> {
  if (buyerId) {
    try {
      await client
        .from("buyer_sms_senders")
        .upsert({ buyer_id: buyerId, from_number: from }, { onConflict: "buyer_id" })
    } catch (err) {
      console.error("recordStickyFrom: buyer_sms_senders upsert failed", err)
    }
  }

  if (threadId) {
    try {
      await client
        .from("message_threads")
        .update({ preferred_from_number: from })
        .eq("id", threadId)
    } catch (err) {
      console.error("recordStickyFrom: message_threads update failed", err)
    }
  }
}
