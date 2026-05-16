import { supabaseAdmin } from "@/lib/supabase/admin"
import { formatPhoneE164, normalizePhone } from "@/lib/dedup-utils"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { FROM_EMAIL, resend } from "@/lib/resend"
import { insertNotification } from "@/lib/notifications"
import type { Buyer, Property, OfferWithRelations } from "@/lib/supabase"
import { resolveFromNumber } from "@/lib/showing-notifications"
import { assertServer } from "@/utils/assert-server"

assertServer()

async function sendOfferSms(offer: OfferWithRelations, buyer: Buyer, property: Property | null | undefined, messageBody: string) {
  if (!buyer.id || !buyer.phone || buyer.can_receive_sms === false) return

  const to = formatPhoneE164(buyer.phone)
  const normalizedTo = normalizePhone(buyer.phone)
  if (!to || !normalizedTo) return

  const from = await resolveFromNumber(buyer.id)
  if (!from) return

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
    if (!response.ok) throw new Error(`Telnyx send failed (${response.status}): ${responseText}`)

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
    console.error(`[offer-sms] Offer SMS notification failed for offer ${offer.id} (${property?.address || "unknown property"}):`, error)
  }
}

async function sendOfferEmail(subject: string, buyer: Buyer, html: string) {
  if (!buyer.email || buyer.can_receive_email === false) return
  if (!resend) return
  await resend.emails.send({ from: FROM_EMAIL, to: buyer.email, subject, html })
}

function offerEmailHtml(title: string, intro: string, property: Property | null | undefined, offerPrice: string, offerType: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <div style="background: #0f172a; color: white; padding: 16px 20px; font-size: 20px; font-weight: 700;">ListHit</div>
      <div style="padding: 24px 20px; background: #ffffff;">
        <h1 style="font-size: 22px; margin: 0 0 12px;">${title}</h1>
        <p style="margin: 0 0 16px; line-height: 1.6;">${intro}</p>
        <p style="margin: 0 0 8px;"><strong>Property:</strong> ${property?.address || "Unknown property"}</p>
        <p style="margin: 0 0 8px;"><strong>Offer Price:</strong> ${offerPrice}</p>
        <p style="margin: 0 0 18px;"><strong>Offer Type:</strong> ${offerType}</p>
        <p style="margin: 0; line-height: 1.6;">Reply to this email or contact us with any questions.</p>
      </div>
      <div style="padding: 14px 20px; font-size: 12px; color: #6b7280; background: #f3f4f6;">Sent by ListHit</div>
    </div>
  `
}

export async function sendOfferStatusNotification(offer: OfferWithRelations, newStatus: string) {
  const buyer = offer.buyers
  const property = offer.properties
  const address = property?.address || "Unknown property"
  const firstName = buyer?.fname || "there"
  const offerPrice = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(offer.offer_price || 0)
  const offerType = offer.offer_type === "cash" ? "Cash" : "Financing"

  await insertNotification({
    type: `offer_${newStatus}`,
    title: `Offer ${newStatus}: ${address}`,
    body: `${buyer?.full_name || "A buyer"} — ${offerPrice}`,
    metadata: { offer_id: offer.id, buyer_id: offer.buyer_id, property_id: offer.property_id },
  })

  if (!buyer) return

  if (newStatus === "withdrawn") return

  if (newStatus === "accepted") {
    const sms = `Great news, ${firstName}! Your offer of ${offerPrice} on ${address} has been accepted! We'll be in touch with next steps.`
    const subject = `Offer Accepted — ${address}`
    await sendOfferSms(offer, buyer, property, sms)
    await sendOfferEmail(subject, buyer, offerEmailHtml("Offer Accepted", sms, property, offerPrice, offerType))
    return
  }

  if (newStatus === "rejected") {
    const sms = `Hi ${firstName}, unfortunately your offer on ${address} was not accepted. Feel free to submit a new offer or reach out with questions.`
    const subject = `Offer Update — ${address}`
    await sendOfferSms(offer, buyer, property, sms)
    await sendOfferEmail(subject, buyer, offerEmailHtml("Offer Update", sms, property, offerPrice, offerType))
    return
  }

  if (newStatus === "countered") {
    const sms = `Hi ${firstName}, we have a counter offer on ${address}. Please check your email or contact us to discuss.`
    const subject = `Counter Offer — ${address}`
    await sendOfferSms(offer, buyer, property, sms)
    await sendOfferEmail(subject, buyer, offerEmailHtml("Counter Offer", sms, property, offerPrice, offerType))
    return
  }

  if (newStatus === "closed") {
    const sms = `Congratulations ${firstName}! The deal on ${address} is officially closed. Thank you for working with us!`
    const subject = `Deal Closed — ${address}`
    await sendOfferSms(offer, buyer, property, sms)
    await sendOfferEmail(subject, buyer, offerEmailHtml("Deal Closed", sms, property, offerPrice, offerType))
    return
  }

  if (newStatus === "submitted") {
    const sms = `Hi ${firstName}, we've received your offer on ${address}. We'll review it and get back to you soon.`
    const subject = `Offer Received — ${address}`
    await sendOfferSms(offer, buyer, property, sms)
    await sendOfferEmail(subject, buyer, offerEmailHtml("Offer Received", sms, property, offerPrice, offerType))
  }
}
