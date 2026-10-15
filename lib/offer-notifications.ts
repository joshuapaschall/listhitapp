import { supabaseAdmin } from "@/lib/supabase/admin"
import { formatPhoneE164, normalizePhone } from "@/lib/dedup-utils"
import { resolveSmsProvider, SmsNotReadyError, type SmsProvider } from "@/lib/providers/sms"
import { sendPlatformEmail } from "@/lib/email/send-platform-email"
import { offerEmail } from "@/lib/email/templates"
import { brandFromIdentity } from "@/lib/email-templates/brand"
import { getOrgIdentity } from "@/lib/org-identity.server"
import { insertNotification } from "@/lib/notifications"
import type { Buyer, Property, OfferWithRelations } from "@/lib/supabase"
import { resolveFromNumber, resolveBuyerOrgId } from "@/lib/showing-notifications"
import { assertServer } from "@/utils/assert-server"

assertServer()

async function sendOfferSms(offer: OfferWithRelations, buyer: Buyer, property: Property | null | undefined, messageBody: string) {
  if (!buyer.id || !buyer.phone || buyer.can_receive_sms === false) return

  const to = formatPhoneE164(buyer.phone)
  const normalizedTo = normalizePhone(buyer.phone)
  if (!to || !normalizedTo) return

  // No org, or an org whose texting isn't set up → skip the SMS. An offer must
  // never fail because texting isn't available; the email still goes out.
  const orgId = await resolveBuyerOrgId(buyer.id)
  if (!orgId) return

  let provider: SmsProvider
  try {
    provider = await resolveSmsProvider(orgId)
  } catch (error) {
    if (error instanceof SmsNotReadyError) {
      console.warn(`[offer-sms] texting isn't set up for org ${orgId} — SMS skipped`)
    } else {
      console.error(`[offer-sms] provider resolution failed — SMS skipped`, error)
    }
    return
  }

  const resolvedFrom = await resolveFromNumber(buyer.id, orgId)
  // Telnyx (owner org) needs an explicit sender; a Twilio Messaging Service picks its own.
  if (!resolvedFrom && provider.name !== "twilio") return

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
      if (threadError) throw threadError
      threadId = createdThread.id
    } else {
      await supabaseAdmin
        .from("message_threads")
        .update({ ...(from ? { preferred_from_number: from } : {}), updated_at: new Date().toISOString() })
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
      org_id: orgId,
    })
  } catch (error) {
    console.error(`[offer-sms] Offer SMS notification failed for offer ${offer.id} (${property?.address || "unknown property"}):`, error)
  }
}

type OfferEmailContent = { subject: string; title: string; message: string; tone: "success" | "warning" | "neutral" }

async function sendOfferEmail(
  offer: OfferWithRelations,
  buyer: Buyer,
  property: Property | null | undefined,
  offerPrice: string,
  offerType: string,
  content: OfferEmailContent,
) {
  if (!buyer.email || buyer.can_receive_email === false) return
  // Buyer-facing: always the tenant's brand, never ListHit's.
  const identity = offer.org_id ? await getOrgIdentity(offer.org_id) : null
  const email = offerEmail({
    brand: brandFromIdentity(identity),
    address: identity?.hasCompleteAddress ? identity.addressSingleLine : null,
    propertyAddress: property?.address || "Unknown property",
    offerPrice,
    offerType,
    ...content,
  })
  const result = await sendPlatformEmail({ to: buyer.email, ...email, category: "offer" })
  if (!result.sent) console.error(`[offer-email] Offer email failed for offer ${offer.id}:`, result.error)
}

export async function sendOfferStatusNotification(offer: OfferWithRelations, newStatus: string) {
  const buyer = offer.buyers
  const property = offer.properties
  const address = property?.address || "Unknown property"
  const firstName = buyer?.fname || "there"
  const offerPrice = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(offer.offer_price || 0)
  const offerType = offer.offer_type === "cash" ? "Cash" : "Financing"

  if (!offer.org_id) {
    console.warn("[offer-notifications] offer has no org — notification skipped", {
      offerId: offer.id,
    })
  } else {
    await insertNotification({
      type: `offer_${newStatus}`,
      title: `Offer ${newStatus}: ${address}`,
      orgId: offer.org_id,
      body: `${buyer?.full_name || "A buyer"} — ${offerPrice}`,
      metadata: { offer_id: offer.id, buyer_id: offer.buyer_id, property_id: offer.property_id },
    })
  }

  if (!buyer) return

  if (newStatus === "withdrawn") return

  if (newStatus === "accepted") {
    const sms = `Great news, ${firstName}! Your offer of ${offerPrice} on ${address} has been accepted! We'll be in touch with next steps.`
    const subject = `Offer Accepted — ${address}`
    await sendOfferSms(offer, buyer, property, sms)
    await sendOfferEmail(offer, buyer, property, offerPrice, offerType, { subject, title: "Offer Accepted", message: sms, tone: "success" })
    return
  }

  if (newStatus === "rejected") {
    const sms = `Hi ${firstName}, unfortunately your offer on ${address} was not accepted. Feel free to submit a new offer or reach out with questions.`
    const subject = `Offer Update — ${address}`
    await sendOfferSms(offer, buyer, property, sms)
    await sendOfferEmail(offer, buyer, property, offerPrice, offerType, { subject, title: "Offer Update", message: sms, tone: "neutral" })
    return
  }

  if (newStatus === "countered") {
    const sms = `Hi ${firstName}, we have a counter offer on ${address}. Please check your email or contact us to discuss.`
    const subject = `Counter Offer — ${address}`
    await sendOfferSms(offer, buyer, property, sms)
    await sendOfferEmail(offer, buyer, property, offerPrice, offerType, { subject, title: "Counter Offer", message: sms, tone: "warning" })
    return
  }

  if (newStatus === "closed") {
    const sms = `Congratulations ${firstName}! The deal on ${address} is officially closed. Thank you for working with us!`
    const subject = `Deal Closed — ${address}`
    await sendOfferSms(offer, buyer, property, sms)
    await sendOfferEmail(offer, buyer, property, offerPrice, offerType, { subject, title: "Deal Closed", message: sms, tone: "success" })
    return
  }

  if (newStatus === "submitted") {
    const sms = `Hi ${firstName}, we've received your offer on ${address}. We'll review it and get back to you soon.`
    const subject = `Offer Received — ${address}`
    await sendOfferSms(offer, buyer, property, sms)
    await sendOfferEmail(offer, buyer, property, offerPrice, offerType, { subject, title: "Offer Received", message: sms, tone: "neutral" })
  }
}
