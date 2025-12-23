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

function buildSignature(buyerId: string, email: string, timestamp: number) {
  const hmac = crypto.createHmac("sha256", getSecret())
  hmac.update(`${buyerId}:${normalizeEmail(email)}:${timestamp}`)
  return hmac.digest("hex")
}

export function signUnsubscribePayload({
  buyerId,
  email,
  timestamp = Date.now(),
}: {
  buyerId: string
  email: string
  timestamp?: number
}) {
  const normalizedTimestamp = typeof timestamp === "number" ? timestamp : Date.now()
  const signature = buildSignature(buyerId, email, normalizedTimestamp)
  return { timestamp: normalizedTimestamp.toString(), signature }
}

export function verifyUnsubscribeSignature({
  buyerId,
  email,
  timestamp,
  signature,
}: {
  buyerId: string
  email: string
  timestamp: string | number
  signature: string
}) {
  try {
    const ts = Number(timestamp)
    if (!ts || Number.isNaN(ts)) return false
    if (Date.now() - ts > UNSUBSCRIBE_MAX_AGE_MS) return false
    const expected = buildSignature(buyerId, email, ts)
    const expectedBuffer = Buffer.from(expected, "hex")
    const providedBuffer = Buffer.from(signature, "hex")
    if (expectedBuffer.length !== providedBuffer.length) return false
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  } catch (error) {
    console.error("Unsubscribe signature verification failed", error)
    return false
  }
}

export function buildUnsubscribeUrl({
  buyerId,
  email,
  baseUrl,
}: {
  buyerId: string
  email: string
  baseUrl?: string
}) {
  const origin = baseUrl || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (!origin) throw new Error("SITE_URL is not configured")
  const { signature, timestamp } = signUnsubscribePayload({ buyerId, email })
  const url = new URL("/unsubscribe", origin)
  url.searchParams.set("id", buyerId)
  url.searchParams.set("e", email)
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
