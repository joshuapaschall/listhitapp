import { supabaseAdmin } from "@/lib/supabase/admin"
import { formatPhoneE164, normalizePhone } from "@/lib/dedup-utils"
import { isOrgTelnyxPinnedEnv } from "@/lib/providers/sms/routing"
import { resolveSmsProvider, SmsNotReadyError, type SmsProvider } from "@/lib/providers/sms"
import { sendPlatformEmail } from "@/lib/email/send-platform-email"
import { showingEmail } from "@/lib/email/templates"
import { brandFromIdentity } from "@/lib/email-templates/brand"
import { getOrgIdentity } from "@/lib/org-identity.server"
import { insertNotification } from "@/lib/notifications"
import type { Buyer, Property, Showing } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"
import { createLogger } from "@/lib/logger"

const log = createLogger("showing-notifications")

assertServer()

// A Twilio org may only send from a number it owns on Twilio. Anything else
// (a Telnyx-era thread number, another org's number) is not a usable sender.
async function isOrgTwilioNumber(orgId: string, e164: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("inbound_numbers")
    .select("e164")
    .eq("org_id", orgId)
    .eq("provider", "twilio")
    .eq("e164", e164)
    .limit(1)
  return !error && Array.isArray(data) && data.length > 0
}

/**
 * The from-number for a buyer notification. The pinned owner org keeps the
 * original order: thread sticky → buyer sticky → DEFAULT_OUTBOUND_DID. Every
 * other org may only use a thread/sticky number it owns on Twilio, never the env
 * DID; null lets the org's Messaging Service pick the sender.
 */
export async function resolveFromNumber(buyerId: string, orgId: string | null): Promise<string | null> {
  log(`[showing-sms] resolveFromNumber called for buyer ${buyerId}`)
  const pinned = isOrgTelnyxPinnedEnv(orgId)
  const usable = async (candidate: string | null) => {
    if (!candidate) return null
    if (pinned) return candidate
    if (!orgId) return null
    return (await isOrgTwilioNumber(orgId, candidate)) ? candidate : null
  }

  const { data: recentThread } = await supabaseAdmin
    .from("message_threads")
    .select("preferred_from_number")
    .eq("buyer_id", buyerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const threadNumber = await usable(formatPhoneE164(recentThread?.preferred_from_number))
  if (threadNumber) {
    log(`[showing-sms] resolved from thread.preferred_from_number: ${threadNumber}`)
    return threadNumber
  }

  const { data: stickySender } = await supabaseAdmin
    .from("buyer_sms_senders")
    .select("from_number")
    .eq("buyer_id", buyerId)
    .maybeSingle()

  const stickyNumber = await usable(formatPhoneE164(stickySender?.from_number))
  if (stickyNumber) {
    log(`[showing-sms] resolved from sticky buyer_sms_senders: ${stickyNumber}`)
    return stickyNumber
  }

  if (!pinned) {
    log(`[showing-sms] no owned Twilio sticky for buyer ${buyerId}; the Messaging Service picks the sender`)
    return null
  }

  const fallback = formatPhoneE164(process.env.DEFAULT_OUTBOUND_DID)
  if (fallback) {
    log(`[showing-sms] resolved from DEFAULT_OUTBOUND_DID: ${fallback}`)
    return fallback
  }

  console.warn(`[showing-sms] NO from number resolved — DEFAULT_OUTBOUND_DID env: ${process.env.DEFAULT_OUTBOUND_DID || "<unset>"}`)
  return null
}

/**
 * Resolve the owning org for a buyer. Notification paths receive only a Buyer
 * object, which carries no org_id, so we read the authoritative value from the
 * buyers table. There is no fallback: an org-less buyer returns null and the
 * caller skips the notification rather than sending it into another tenant.
 */
export async function resolveBuyerOrgId(buyerId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("buyers")
    .select("org_id")
    .eq("id", buyerId)
    .maybeSingle()

  if (error) {
    console.error("[notifications] resolveBuyerOrgId failed", { buyerId, error })
    return null
  }

  const orgId = (data as { org_id?: string | null } | null)?.org_id ?? null
  if (!orgId) {
    console.warn("[notifications] buyer has no org — skipping notification", { buyerId })
  }
  return orgId
}

async function sendShowingSms(showing: Showing, buyer: Buyer, property: Property | null | undefined, messageBody: string) {
  log(`[showing-sms] sendShowingSms START for showing ${showing.id}`, {
    buyerId: buyer?.id,
    hasPhone: !!buyer?.phone,
    phoneValue: buyer?.phone,
    canReceiveSms: buyer?.can_receive_sms,
  })

  if (!buyer.id) {
    console.warn(`[showing-sms] BAIL: buyer.id is missing`)
    return
  }
  if (!buyer.phone) {
    console.warn(`[showing-sms] BAIL: buyer.phone is missing for buyer ${buyer.id}`)
    return
  }
  if (buyer.can_receive_sms === false) {
    console.warn(`[showing-sms] BAIL: buyer.can_receive_sms === false for buyer ${buyer.id}`)
    return
  }

  const to = formatPhoneE164(buyer.phone)
  const normalizedTo = normalizePhone(buyer.phone)
  if (!to || !normalizedTo) {
    console.warn(`[showing-sms] BAIL: phone format invalid`, { rawPhone: buyer.phone, to, normalizedTo })
    return
  }

  // No org → no provider to send through. Skip; a showing never fails on SMS.
  const orgId = await resolveBuyerOrgId(buyer.id)
  if (!orgId) {
    console.warn(`[showing-sms] BAIL: buyer ${buyer.id} has no org — SMS skipped`)
    return
  }

  let provider: SmsProvider
  try {
    provider = await resolveSmsProvider(orgId)
  } catch (error) {
    if (error instanceof SmsNotReadyError) {
      console.warn(`[showing-sms] BAIL: texting isn't set up for org ${orgId} — SMS skipped`)
    } else {
      console.error(`[showing-sms] provider resolution failed — SMS skipped`, error)
    }
    return
  }

  const resolvedFrom = await resolveFromNumber(buyer.id, orgId)
  // Telnyx (owner org) needs an explicit sender; a Twilio Messaging Service picks its own.
  if (!resolvedFrom && provider.name !== "twilio") {
    console.warn(`[showing-sms] BAIL: no sender DID resolved for buyer ${buyer.id}`)
    return
  }

  log(`[showing-sms] About to send via ${provider.name}`, {
    from: resolvedFrom,
    to,
    bodyPreview: messageBody.slice(0, 60),
  })

  try {
    const result = await provider.sendMessage({
      from: resolvedFrom,
      to,
      text: messageBody,
      messagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID,
      type: "SMS",
      useProfileWebhooks: true,
    })
    const providerId: string | null = result.id || null
    const from = resolvedFrom || formatPhoneE164(result.from) || result.from || null
    log(`[showing-sms] ${provider.name} accepted, provider_id: ${providerId}`)

    const { data: existingThread } = await supabaseAdmin
      .from("message_threads")
      .select("id")
      .eq("buyer_id", buyer.id)
      .eq("phone_number", normalizedTo)
      .maybeSingle()

    let threadId = existingThread?.id
    if (!threadId) {
      const { data: createdThread, error: threadError } = await supabaseAdmin
        .from("message_threads")
        .insert({
          buyer_id: buyer.id,
          phone_number: normalizedTo,
          ...(from ? { preferred_from_number: from } : {}),
          unread: false,
          updated_at: new Date().toISOString(),
          org_id: orgId,
        })
        .select("id")
        .single()
      if (threadError) {
        console.error(`[showing-sms] Failed to create thread:`, threadError)
        throw threadError
      }
      threadId = createdThread.id
      log(`[showing-sms] Created new thread ${threadId}`)
    } else {
      await supabaseAdmin
        .from("message_threads")
        .update({ ...(from ? { preferred_from_number: from } : {}), updated_at: new Date().toISOString() })
        .eq("id", threadId)
      log(`[showing-sms] Updated existing thread ${threadId}`)
    }

    const { error: msgError } = await supabaseAdmin.from("messages").insert({
      thread_id: threadId,
      buyer_id: buyer.id,
      direction: "outbound",
      from_number: from,
      to_number: to,
      body: messageBody,
      provider_id: providerId,
      is_bulk: false,
      org_id: orgId,
    })
    if (msgError) {
      console.error(`[showing-sms] Failed to insert message row:`, msgError)
    } else {
      log(`[showing-sms] SUCCESS — SMS sent and logged to messages table`)
    }
  } catch (error) {
    console.error(`[showing-sms] Showing SMS notification failed:`, error)
  }
}

async function sendShowingEmail(
  showing: Showing,
  buyer: Buyer,
  property: Property | null | undefined,
  kind: "confirmed" | "reminder",
  when: string,
) {
  if (!buyer.email || buyer.can_receive_email === false) {
    log("Skipping showing email: no email or email opt-out", { email: buyer.email, canReceive: buyer.can_receive_email })
    return
  }
  // Buyer-facing: always the tenant's brand, never ListHit's.
  const identity = showing.org_id ? await getOrgIdentity(showing.org_id) : null
  const email = showingEmail({
    brand: brandFromIdentity(identity),
    address: identity?.hasCompleteAddress ? identity.addressSingleLine : null,
    kind,
    buyerFirstName: buyer.fname,
    propertyAddress: property?.address || "Unknown property",
    when,
  })
  log("Sending showing email:", { to: buyer.email, subject: email.subject })
  const result = await sendPlatformEmail({ to: buyer.email, ...email, category: "showing" })
  if (!result.sent) console.error("Showing email notification failed:", result.error)
}

export async function sendShowingConfirmation(showing: Showing, buyer?: Buyer | null, property?: Property | null) {
  const tz = process.env.APP_TIMEZONE || "America/New_York"
  const formattedDateTime = new Date(showing.scheduled_at || "").toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  })

  if (!showing.org_id) {
    console.warn("[showing-notifications] showing has no org — notification skipped", {
      showingId: showing.id,
    })
  } else {
    await insertNotification({
      type: "showing_scheduled",
      title: `Showing scheduled: ${property?.address || "Unknown property"}`,
      orgId: showing.org_id,
      body: `${buyer?.full_name || "A buyer"} — ${formattedDateTime}`,
      metadata: { showing_id: showing.id, buyer_id: showing.buyer_id, property_id: showing.property_id },
    })
  }

  if (buyer) {
    await sendShowingSms(
      showing,
      buyer,
      property,
      `Hi ${buyer.fname || "there"}! Your showing at ${property?.address || "our property"} is confirmed for ${formattedDateTime}. Reply to this message if you need to reschedule.`,
    )

    await sendShowingEmail(showing, buyer, property, "confirmed", formattedDateTime)
  }
}

export async function sendShowingReminder(showing: Showing, buyer?: Buyer | null, property?: Property | null) {
  const tz = process.env.APP_TIMEZONE || "America/New_York"
  const formattedDateTime = new Date(showing.scheduled_at || "").toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  })

  if (!showing.org_id) {
    console.warn("[showing-notifications] showing has no org — notification skipped", {
      showingId: showing.id,
    })
  } else {
    await insertNotification({
      type: "showing_reminder",
      title: `Showing reminder: ${property?.address || "Unknown property"}`,
      orgId: showing.org_id,
      body: `${buyer?.full_name || "A buyer"} — ${formattedDateTime}`,
      metadata: { showing_id: showing.id, buyer_id: showing.buyer_id, property_id: showing.property_id },
    })
  }

  if (buyer) {
    await sendShowingSms(
      showing,
      buyer,
      property,
      `Reminder: Your showing at ${property?.address || "the property"} is in about 1 hour (${formattedDateTime}). See you there!`,
    )

    await sendShowingEmail(showing, buyer, property, "reminder", formattedDateTime)
  }
}
