import crypto from "crypto"

export const UNSUBSCRIBE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function getSecret() {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET
  if (!secret) {
    throw new Error("EMAIL_UNSUBSCRIBE_SECRET is not configured")
  }
  return secret
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function buildSignature({
  buyerId,
  email,
  campaignId,
  recipientId,
  timestamp,
}: {
  buyerId: string
  email: string
  campaignId?: string
  recipientId?: string
  timestamp: number
}) {
  const hmac = crypto.createHmac("sha256", getSecret())
  const parts = [buyerId, normalizeEmail(email)]
  if (campaignId) parts.push(campaignId)
  if (recipientId) parts.push(recipientId)
  parts.push(String(timestamp))
  hmac.update(parts.join(":"))
  return hmac.digest("hex")
}

export function signUnsubscribePayload({
  buyerId,
  email,
  campaignId,
  recipientId,
  timestamp = Date.now(),
}: {
  buyerId: string
  email: string
  campaignId?: string
  recipientId?: string
  timestamp?: number
}) {
  const normalizedTimestamp = typeof timestamp === "number" ? timestamp : Date.now()
  const signature = buildSignature({
    buyerId,
    email,
    campaignId,
    recipientId,
    timestamp: normalizedTimestamp,
  })
  return { timestamp: normalizedTimestamp.toString(), signature }
}

export function verifyUnsubscribeSignature({
  buyerId,
  email,
  campaignId,
  recipientId,
  timestamp,
  signature,
}: {
  buyerId: string
  email: string
  campaignId?: string
  recipientId?: string
  timestamp: string | number
  signature: string
}) {
  try {
    const ts = Number(timestamp)
    if (!ts || Number.isNaN(ts)) return false
    if (Date.now() - ts > UNSUBSCRIBE_MAX_AGE_MS) return false
    const expectedSignatures = [
      buildSignature({ buyerId, email, campaignId, recipientId, timestamp: ts }),
    ]
    const legacySignature = buildSignature({ buyerId, email, timestamp: ts })
    if (!expectedSignatures.includes(legacySignature)) {
      expectedSignatures.push(legacySignature)
    }
    const providedBuffer = Buffer.from(signature, "hex")
    for (const expected of expectedSignatures) {
      const expectedBuffer = Buffer.from(expected, "hex")
      if (expectedBuffer.length !== providedBuffer.length) continue
      if (crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
        return true
      }
    }
    return false
  } catch (error) {
    console.error("Unsubscribe signature verification failed", error)
    return false
  }
}

export function buildUnsubscribeUrl({
  buyerId,
  email,
  baseUrl,
  campaignId,
  recipientId,
}: {
  buyerId: string
  email: string
  baseUrl?: string
  campaignId?: string
  recipientId?: string
}) {
  const origin = baseUrl || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (!origin) throw new Error("SITE_URL is not configured")
  const { signature, timestamp } = signUnsubscribePayload({
    buyerId,
    email,
    campaignId,
    recipientId,
  })
  const url = new URL("/api/unsubscribe", origin)
  url.searchParams.set("id", buyerId)
  url.searchParams.set("e", email)
  if (campaignId) url.searchParams.set("campaignId", campaignId)
  if (recipientId) url.searchParams.set("recipientId", recipientId)
  url.searchParams.set("t", timestamp)
  url.searchParams.set("s", signature)
  return url.toString()
}

export function appendUnsubscribeFooter(
  html: string,
  {
    unsubscribeUrl,
    physicalAddress,
  }: {
    unsubscribeUrl: string
    physicalAddress?: string
  },
) {
  const addressLine = physicalAddress || "ListHit CRM · 123 Main St · Anytown, USA"
  const footer = `\n<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#4b5563;line-height:1.5;">\n  <p style="margin:0 0 8px 0;">If you no longer wish to receive these emails, <a href="${unsubscribeUrl}">unsubscribe here</a>.</p>\n  <p style="margin:0;">${addressLine}</p>\n</div>\n`
  const closingBodyTag = /<\/body>/i
  if (closingBodyTag.test(html)) {
    return html.replace(closingBodyTag, `${footer}</body>`)
  }
  return `${html}${footer}`
}
