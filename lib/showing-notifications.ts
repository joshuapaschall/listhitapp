import { supabaseAdmin } from "@/lib/supabase/admin"
import { formatPhoneE164, normalizePhone } from "@/lib/dedup-utils"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { FROM_EMAIL, resend } from "@/lib/resend"
import { insertNotification } from "@/lib/notifications"
import type { Buyer, Property, Showing } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function resolveFromNumber(buyerId: string): Promise<string | null> {
  const { data: recentThread } = await supabaseAdmin
    .from("message_threads")
    .select("preferred_from_number")
    .eq("buyer_id", buyerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const threadNumber = formatPhoneE164(recentThread?.preferred_from_number)
  if (threadNumber) return threadNumber

  const { data: stickySender } = await supabaseAdmin
    .from("buyer_sms_senders")
    .select("from_number")
    .eq("buyer_id", buyerId)
    .maybeSingle()

  const stickyNumber = formatPhoneE164(stickySender?.from_number)
  if (stickyNumber) return stickyNumber

  return formatPhoneE164(process.env.DEFAULT_OUTBOUND_DID) || null
}

async function sendShowingSms(showing: Showing, buyer: Buyer, property: Property | null | undefined, messageBody: string) {
  if (!buyer.id || !buyer.phone || buyer.can_receive_sms === false) return

  const to = formatPhoneE164(buyer.phone)
  const normalizedTo = normalizePhone(buyer.phone)
  if (!to || !normalizedTo) return

  const from = await resolveFromNumber(buyer.id)
  if (!from) {
    console.warn(`No sender DID resolved for buyer ${buyer.id}; skipping showing SMS`)
    return
  }

  try {
    const response = await fetch(`${TELNYX_API_URL}/messages`, {
      method: "POST",
      headers: telnyxHeaders(),
      body: JSON.stringify({
        from,
        to,
        text: messageBody,
        messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
        type: "SMS",
        use_profile_webhooks: true,
      }),
    })

    const responseText = await response.text()
    if (!response.ok) {
      throw new Error(`Telnyx send failed (${response.status}): ${responseText}`)
    }

    const payload = responseText ? JSON.parse(responseText) : {}
    const providerId: string | null = payload?.data?.id || null

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
          preferred_from_number: from,
          unread: false,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single()
      if (threadError) throw threadError
      threadId = createdThread.id
    } else {
      await supabaseAdmin
        .from("message_threads")
        .update({ preferred_from_number: from, updated_at: new Date().toISOString() })
        .eq("id", threadId)
    }

    await supabaseAdmin.from("messages").insert({
      thread_id: threadId,
      buyer_id: buyer.id,
      direction: "outbound",
      from_number: from,
      to_number: to,
      body: messageBody,
      provider_id: providerId,
      is_bulk: false,
    })
  } catch (error) {
    console.error("Showing SMS notification failed:", error)
  }
}

async function sendShowingEmail(subject: string, buyer: Buyer, html: string) {
  if (!buyer.email || buyer.can_receive_email === false) {
    console.log("Skipping showing email: no email or email opt-out", { email: buyer.email, canReceive: buyer.can_receive_email })
    return
  }
  if (!resend) {
    console.warn("Skipping showing email: Resend not configured (missing RESEND_API_KEY)")
    return
  }
  try {
    console.log("Sending showing email:", { to: buyer.email, subject, from: FROM_EMAIL })
    const result = await resend.emails.send({ from: FROM_EMAIL, to: buyer.email, subject, html })
    console.log("Showing email sent successfully:", result)
  } catch (error) {
    console.error("Showing email notification failed:", error)
  }
}

function baseEmailHtml(title: string, intro: string, property: Property | null | undefined, when: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <div style="background: #0f172a; color: white; padding: 16px 20px; font-size: 20px; font-weight: 700;">ListHit</div>
      <div style="padding: 24px 20px; background: #ffffff;">
        <h1 style="font-size: 22px; margin: 0 0 12px;">${title}</h1>
        <p style="margin: 0 0 16px; line-height: 1.6;">${intro}</p>
        <p style="margin: 0 0 8px;"><strong>Property:</strong> ${property?.address || "Unknown property"}</p>
        <p style="margin: 0 0 18px;"><strong>Date & Time:</strong> ${when}</p>
        <p style="margin: 0; line-height: 1.6;">Reply to this email or call us if you need to reschedule.</p>
      </div>
      <div style="padding: 14px 20px; font-size: 12px; color: #6b7280; background: #f3f4f6;">Sent by ListHit</div>
    </div>
  `
}

export async function sendShowingConfirmation(showing: Showing, buyer?: Buyer | null, property?: Property | null) {
  const tz = process.env.APP_TIMEZONE || "America/New_York"
  const formattedDateTime = new Date(showing.scheduled_at || "").toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  })

  await insertNotification({
    type: "showing_scheduled",
    title: `Showing scheduled: ${property?.address || "Unknown property"}`,
    body: `${buyer?.full_name || "A buyer"} — ${formattedDateTime}`,
    metadata: { showing_id: showing.id, buyer_id: showing.buyer_id, property_id: showing.property_id },
  })

  if (buyer) {
    await sendShowingSms(
      showing,
      buyer,
      property,
      `Hi ${buyer.fname || "there"}! Your showing at ${property?.address || "our property"} is confirmed for ${formattedDateTime}. Reply to this message if you need to reschedule.`,
    )

    await sendShowingEmail(
      `Showing Confirmed — ${property?.address || "Property Showing"}`,
      buyer,
      baseEmailHtml("Your showing has been confirmed", "Your showing has been confirmed.", property, formattedDateTime),
    )
  }
}

export async function sendShowingReminder(showing: Showing, buyer?: Buyer | null, property?: Property | null) {
  const tz = process.env.APP_TIMEZONE || "America/New_York"
  const formattedDateTime = new Date(showing.scheduled_at || "").toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  })

  await insertNotification({
    type: "showing_reminder",
    title: `Showing reminder: ${property?.address || "Unknown property"}`,
    body: `${buyer?.full_name || "A buyer"} — ${formattedDateTime}`,
    metadata: { showing_id: showing.id, buyer_id: showing.buyer_id, property_id: showing.property_id },
  })

  if (buyer) {
    await sendShowingSms(
      showing,
      buyer,
      property,
      `Reminder: Your showing at ${property?.address || "the property"} is in about 1 hour (${formattedDateTime}). See you there!`,
    )

    await sendShowingEmail(
      `Reminder: Showing in 1 Hour — ${property?.address || "Property Showing"}`,
      buyer,
      baseEmailHtml("Your showing is coming up!", "This is a reminder that your showing is coming up in about an hour.", property, formattedDateTime),
    )
  }
}
