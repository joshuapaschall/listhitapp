// Every transactional email ListHit sends, as pure builders over renderEmail.
// Senders (notify.ts, account-emails.ts, the DNS/onboarding routes, showing and
// offer notifications) call these; the admin preview page and the tests render
// the same builders with sample data, so what Josh reviews is what ships.
//
// Customer-facing copy never uses carrier or infrastructure jargon.

import type { BrandConfig } from "@/lib/email-templates/brand"
import { listhitFooter, renderEmail, type EmailInput } from "@/lib/email/layout"

export type RenderedEmail = { subject: string; html: string; text: string }

export function appUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://app.listhit.io").replace(/\/+$/, "")
  return `${base}${path}`
}

function build(subject: string, input: EmailInput): RenderedEmail {
  return { subject, ...renderEmail(input) }
}

function formatDate(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
}

export function formatUsPhone(e164: string | null | undefined): string {
  const m = (e164 || "").match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164 || ""
}

// ---- Texting --------------------------------------------------------------------

export function textingLiveEmail(p: { firstName?: string | null; phoneNumber: string | null; approvedAt?: string | null; business?: string | null }): RenderedEmail {
  const name = (p.firstName || "").trim()
  return build("Texting is live on ListHit", {
    theme: "listhit",
    preheader: "The carriers approved your texting. Your buyers can hear from you now.",
    eyebrow: { text: "Approved by the carriers", tone: "success" },
    heading: name ? `Texting is live, ${name}` : "Texting is live",
    paragraphs: ["Your texting registration is approved. You can text your buyers from ListHit starting now."],
    details: [
      { label: "Your number", value: formatUsPhone(p.phoneNumber) || "Your ListHit number" },
      { label: "Approved", value: formatDate(p.approvedAt) },
    ],
    button: { label: "Send your first deal", url: appUrl("/campaigns/new") },
    tip: "Buyers who sign up on your website are already opted in to texts.",
    footer: listhitFooter(p.business),
  })
}

export function actionNeededEmail(p: { issues: string[]; business?: string | null }): RenderedEmail {
  const many = p.issues.length > 1
  return build("Action needed to finish texting setup", {
    theme: "listhit",
    preheader: many ? "A few quick fixes and your texting setup can continue." : "One quick fix and your texting setup can continue.",
    eyebrow: { text: "Action needed", tone: "warning" },
    heading: many ? "A few quick fixes to finish texting setup" : "One quick fix to finish texting setup",
    paragraphs: ["The carriers need a change before they can finish reviewing your business. Here's what to update:"],
    list: p.issues,
    button: { label: "Fix it now", url: appUrl("/getting-started/texting") },
    tip: "Once you resubmit, review usually takes a few business days. We'll email you.",
    footer: listhitFooter(p.business),
  })
}

export function adminAwaitingApprovalEmail(p: {
  orgId: string
  workspace: string
  business: string
  typeLabel: string
  website: string
  websiteOk: boolean
  estimatedCost: string
}): RenderedEmail {
  return build(`ListHit: ${p.workspace} is waiting for texting approval`, {
    theme: "listhit",
    preheader: `${p.business} submitted a texting registration. Review and approve to continue.`,
    eyebrow: { text: "Needs your approval", tone: "neutral" },
    heading: "New texting registration to approve",
    paragraphs: ["Nothing that costs money happens until you approve. The number, the business registration and the texting program all wait for you."],
    details: [
      { label: "Workspace", value: p.workspace },
      { label: "Business", value: p.business },
      { label: "Type", value: p.typeLabel },
      { label: "Website", value: `${p.website || "None"}${p.websiteOk ? " ✓ privacy and terms load" : ""}` },
      { label: "Est. carrier cost", value: p.estimatedCost },
    ],
    button: { label: "Review and approve", url: appUrl(`/admin/approvals/${p.orgId}`) },
    footer: { reason: "You're getting this because you're a ListHit platform admin.", address: process.env.LISTHIT_MAILING_ADDRESS || undefined },
  })
}

// ---- Domains --------------------------------------------------------------------

export function websiteLiveEmail(p: { domain: string; business?: string | null }): RenderedEmail {
  const url = `https://${p.domain}`
  return build(`Your website is live at ${p.domain}`, {
    theme: "listhit",
    preheader: `${p.domain} is connected and secured. Buyers can visit it now.`,
    eyebrow: { text: "Domain connected", tone: "success" },
    heading: "Your website is live",
    paragraphs: [`${p.domain} is connected to your ListHit website and secured with https.`],
    details: [{ label: "Address", value: url }],
    button: { label: "Visit your site", url },
    tip: "Share this address with buyers. Anyone who signs up there is added to your buyer list.",
    footer: listhitFooter(p.business),
  })
}

export function emailReadyEmail(p: { domain: string; fromAddress?: string | null; business?: string | null }): RenderedEmail {
  return build("Your email sending is set up", {
    theme: "listhit",
    preheader: `Email from ${p.domain} is ready to send from ListHit.`,
    eyebrow: { text: "Ready to send", tone: "success" },
    heading: "Your email sending is set up",
    paragraphs: [`${p.domain} is verified. Emails you send from ListHit will come from your own domain.`],
    details: [{ label: "From address", value: p.fromAddress || `Choose one on ${p.domain}` }],
    button: { label: p.fromAddress ? "Send a test email" : "Choose your from address", url: appUrl("/getting-started/email") },
    footer: listhitFooter(p.business),
  })
}

export function dnsShareEmail(p: {
  domain: string
  businessName: string
  providerLabel: string
  steps: string[]
  records: Array<{ type: string; host: string; value: string }>
  note?: string | null
  senderName?: string | null
}): RenderedEmail {
  const who = (p.senderName || "").trim() || p.businessName
  const details: Array<{ label: string; value: string }> = []
  p.records.forEach((r, i) => {
    const n = p.records.length > 1 ? ` ${i + 1}` : ""
    details.push({ label: `Record${n} · Type`, value: r.type }, { label: `Record${n} · Name`, value: r.host }, { label: `Record${n} · Value`, value: r.value })
  })
  const paragraphs = [`${who} asked you to add ${p.records.length === 1 ? "this record" : "these records"} to ${p.domain}, which is managed at ${p.providerLabel}.`]
  if (p.note?.trim()) paragraphs.push(`Note from ${who}: "${p.note.trim()}"`)
  return build(`Please add these records to ${p.domain} for ${p.businessName}`, {
    theme: "listhit",
    preheader: `${p.records.length} record${p.records.length === 1 ? "" : "s"} to add at ${p.providerLabel}, with exact values.`,
    heading: `Please add these records to ${p.domain}`,
    paragraphs,
    list: p.steps,
    details,
    tip: "Copy each value exactly. Changes usually show up within 5–30 minutes.",
    footer: { reason: `You're getting this because ${who} uses ListHit and shared these steps with you.`, address: process.env.LISTHIT_MAILING_ADDRESS || undefined },
  })
}

// ---- Account lifecycle ------------------------------------------------------------

export function inviteEmail(p: { orgName: string; inviteUrl: string; inviterName?: string | null }): RenderedEmail {
  const inviter = (p.inviterName || "").trim()
  return build(`You've been invited to ${p.orgName}`, {
    theme: "listhit",
    preheader: `${inviter || "Your team"} invited you to ${p.orgName} on ListHit.`,
    heading: `Join ${p.orgName} on ListHit`,
    paragraphs: [`${inviter ? `${inviter} invited you` : "You've been invited"} to join ${p.orgName}. Choose a password to finish setting up your account.`],
    button: { label: "Set your password", url: p.inviteUrl },
    tip: "This link works once and expires after a short time.",
    footer: listhitFooter(p.orgName),
  })
}

export function passwordResetEmail(p: { orgName: string; resetUrl: string }): RenderedEmail {
  return build(`Reset your ${p.orgName} password`, {
    theme: "listhit",
    preheader: "Choose a new password for your ListHit account.",
    heading: "Reset your password",
    paragraphs: [`Someone asked to reset the password for your ${p.orgName} account. Choose a new one below. If this wasn't you, you can ignore this email.`],
    button: { label: "Choose a new password", url: p.resetUrl },
    tip: "This link works once and expires after a short time.",
    footer: listhitFooter(p.orgName),
  })
}

export function accountReadyEmail(p: { orgName: string; signInUrl: string }): RenderedEmail {
  return build(`Your ${p.orgName} account is ready`, {
    theme: "listhit",
    preheader: `An admin set up your ${p.orgName} account on ListHit.`,
    heading: `Your ${p.orgName} account is ready`,
    paragraphs: [`An admin created an account for you at ${p.orgName} and set your password. They'll share it with you directly. This email never contains it.`],
    button: { label: "Sign in", url: p.signInUrl },
    footer: listhitFooter(p.orgName),
  })
}

// ---- Buyer-facing (tenant brand) -----------------------------------------------------

function tenantFooter(brand: BrandConfig, address?: string | null): EmailInput["footer"] {
  return {
    reason: `You're getting this because you're working with ${brand.companyName} on a property.`,
    address: (address || "").trim() || undefined,
  }
}

export function showingEmail(p: {
  brand: BrandConfig
  address?: string | null
  kind: "confirmed" | "reminder"
  buyerFirstName?: string | null
  propertyAddress: string
  when: string
}): RenderedEmail {
  const reminder = p.kind === "reminder"
  const hi = (p.buyerFirstName || "").trim()
  return build(reminder ? `Reminder: Showing in 1 Hour — ${p.propertyAddress}` : `Showing Confirmed — ${p.propertyAddress}`, {
    theme: { brand: p.brand },
    preheader: reminder ? `Your showing at ${p.propertyAddress} starts in about an hour.` : `Your showing at ${p.propertyAddress} is confirmed for ${p.when}.`,
    eyebrow: reminder ? { text: "Coming up soon", tone: "neutral" } : { text: "Confirmed", tone: "success" },
    heading: reminder ? "Your showing is coming up" : "Your showing is confirmed",
    paragraphs: [
      `${hi ? `Hi ${hi}, ` : ""}${reminder ? "this is a reminder that your showing starts in about an hour." : "your showing is confirmed. Here are the details."}`,
    ],
    details: [
      { label: "Property", value: p.propertyAddress },
      { label: "Date & time", value: p.when },
    ],
    tip: "Need to reschedule? Just reply to this email.",
    footer: tenantFooter(p.brand, p.address),
  })
}

export function offerEmail(p: {
  brand: BrandConfig
  address?: string | null
  title: string
  message: string
  propertyAddress: string
  offerPrice: string
  offerType: string
  tone?: "success" | "warning" | "neutral"
  subject: string
}): RenderedEmail {
  return build(p.subject, {
    theme: { brand: p.brand },
    preheader: p.message.slice(0, 110),
    eyebrow: { text: p.title, tone: p.tone ?? "neutral" },
    heading: p.title,
    paragraphs: [p.message],
    details: [
      { label: "Property", value: p.propertyAddress },
      { label: "Offer price", value: p.offerPrice },
      { label: "Offer type", value: p.offerType },
    ],
    tip: "Questions? Just reply to this email.",
    footer: tenantFooter(p.brand, p.address),
  })
}
