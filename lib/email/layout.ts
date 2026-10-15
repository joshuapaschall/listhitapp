// One transactional email design for everything ListHit sends: platform emails
// (ListHit theme) and buyer-facing notifications (the tenant's brand). Pure — no
// I/O — so tests, the admin preview page and the Supabase auth-template builder
// render exactly what production sends.
//
// Rules: table layout, inline CSS only, every input escaped (no raw HTML in), a
// bulletproof button with a VML fallback for Outlook, and colors that stay
// legible when Gmail/Apple Mail invert them for dark mode.

import type { BrandConfig } from "@/lib/email-templates/brand"

export type EmailTone = "success" | "warning" | "neutral"

export type EmailTheme = "listhit" | { brand: BrandConfig; logoUrl?: string | null }

export type EmailInput = {
  theme: EmailTheme
  preheader: string
  eyebrow?: { text: string; tone: EmailTone }
  heading: string
  paragraphs: string[]
  details?: Array<{ label: string; value: string }>
  list?: string[]
  button?: { label: string; url: string }
  tip?: string
  footer: { reason: string; address?: string }
}

export const LISTHIT_RED = "#E5484D"
export const LISTHIT_LOGO_URL = "https://app.listhit.io/brand/icon.png"

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const PAGE_BG = "#F4F4F5"
const CARD_BG = "#FFFFFF"
const TEXT = "#18181B"
const BODY = "#3F3F46"
// Mid-gray that keeps 4.5:1 on white and still reads when a client inverts it.
const MUTED = "#52525B"
const BORDER = "#E4E4E7"

const TONES: Record<EmailTone, { fg: string; bg: string }> = {
  success: { fg: "#047857", bg: "#ECFDF5" },
  warning: { fg: "#B45309", bg: "#FFFBEB" },
  neutral: { fg: "#3F3F46", bg: "#F4F4F5" },
}

export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Only http(s) and mailto links make it into an href — plus a bare Supabase
// template variable like {{ .ConfirmationURL }} for the auth email templates.
function safeUrl(url: string): string {
  const v = String(url ?? "").trim()
  if (/^\{\{\s*\.[A-Za-z]+\s*\}\}$/.test(v)) return v
  return /^(https?:|mailto:)/i.test(v) ? v : "#"
}

function hexColor(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value.trim()) ? value.trim() : fallback
}

// BrandConfig.address is pre-escaped HTML joined with <br/>; turn it back into text.
function brandAddressText(address: string): string {
  if (!address || address.startsWith("[")) return ""
  return address
    .split(/<br\s*\/?>/i)
    .map((line) =>
      line.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim(),
    )
    .filter(Boolean)
    .join(", ")
}

type ResolvedTheme = { name: string; accent: string; logoUrl: string | null; address: string }

function resolveTheme(theme: EmailTheme): ResolvedTheme {
  if (theme === "listhit") return { name: "ListHit", accent: LISTHIT_RED, logoUrl: LISTHIT_LOGO_URL, address: "" }
  const brand = theme.brand
  return {
    name: brand.companyName || "Your company",
    accent: hexColor(brand.colors?.navy, LISTHIT_RED),
    logoUrl: theme.logoUrl ? safeUrl(theme.logoUrl) : null,
    address: brandAddressText(brand.address),
  }
}

function headerHtml(t: ResolvedTheme, isListhit: boolean): string {
  const name = escapeHtml(t.name)
  const logo = t.logoUrl
    ? `<img src="${escapeHtml(t.logoUrl)}" width="24" height="24" alt="" style="display:block;border:0;outline:none;width:24px;height:24px;border-radius:6px;" />`
    : ""
  const nameColor = isListhit ? TEXT : t.accent
  return `
<tr><td style="padding:28px 32px 0 32px;" class="px">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    ${logo ? `<td style="padding:0 8px 0 0;vertical-align:middle;">${logo}</td>` : ""}
    <td style="vertical-align:middle;font-family:${FONT};font-size:16px;line-height:24px;font-weight:700;color:${nameColor};">${name}</td>
  </tr></table>
</td></tr>`
}

function buttonHtml(label: string, url: string, accent: string): string {
  const href = escapeHtml(safeUrl(url))
  const text = escapeHtml(label)
  return `
<tr><td style="padding:8px 0 4px 0;">
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:46px;v-text-anchor:middle;width:260px;" arcsize="18%" stroke="f" fillcolor="${accent}">
    <w:anchorlock/>
    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${text}</center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-table"><tr>
    <td class="btn-cell" style="border-radius:8px;background-color:${accent};" bgcolor="${accent}">
      <a href="${href}" target="_blank" class="btn" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${accent};">${text}</a>
    </td>
  </tr></table>
  <!--<![endif]-->
</td></tr>
<tr><td style="padding:12px 0 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">
  Or copy this link:<br /><a href="${href}" style="color:${accent};text-decoration:underline;word-break:break-all;">${escapeHtml(safeUrl(url))}</a>
</td></tr>`
}

function detailsHtml(details: Array<{ label: string; value: string }>): string {
  const rows = details
    .map(
      (d, i) => `
    <tr>
      <td style="padding:10px 16px;${i ? `border-top:1px solid ${BORDER};` : ""}font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};width:40%;vertical-align:top;" class="dl">${escapeHtml(d.label)}</td>
      <td style="padding:10px 16px;${i ? `border-top:1px solid ${BORDER};` : ""}font-family:${FONT};font-size:14px;line-height:20px;color:${TEXT};font-weight:600;vertical-align:top;word-break:break-word;" class="dv">${escapeHtml(d.value)}</td>
    </tr>`,
    )
    .join("")
  return `
<tr><td style="padding:4px 0 20px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:10px;border-collapse:separate;background-color:#FAFAFA;" bgcolor="#FAFAFA">${rows}
  </table>
</td></tr>`
}

function listHtml(items: string[]): string {
  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:0 10px 10px 0;vertical-align:top;font-family:${FONT};font-size:15px;line-height:24px;color:${TEXT};">&#8226;</td>
      <td style="padding:0 0 10px 0;font-family:${FONT};font-size:15px;line-height:24px;color:${BODY};">${escapeHtml(item)}</td>
    </tr>`,
    )
    .join("")
  return `
<tr><td style="padding:0 0 14px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}
  </table>
</td></tr>`
}

export function renderEmail(input: EmailInput): { html: string; text: string } {
  const t = resolveTheme(input.theme)
  const isListhit = input.theme === "listhit"
  const preheader = (input.preheader || "").slice(0, 110)
  const tone = input.eyebrow ? TONES[input.eyebrow.tone] : null
  const footerAddress = input.footer.address ?? (isListhit ? "" : t.address)

  const body: string[] = []
  if (input.eyebrow && tone) {
    body.push(`
<tr><td style="padding:0 0 12px 0;">
  <span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:${tone.bg};font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.02em;color:${tone.fg};">${escapeHtml(input.eyebrow.text)}</span>
</td></tr>`)
  }
  body.push(`
<tr><td style="padding:0 0 12px 0;font-family:${FONT};font-size:22px;line-height:30px;font-weight:700;color:${TEXT};" class="h1">${escapeHtml(input.heading)}</td></tr>`)
  for (const p of input.paragraphs) {
    body.push(`
<tr><td style="padding:0 0 16px 0;font-family:${FONT};font-size:15px;line-height:24px;color:${BODY};">${escapeHtml(p)}</td></tr>`)
  }
  if (input.list?.length) body.push(listHtml(input.list))
  if (input.details?.length) body.push(detailsHtml(input.details))
  if (input.button) body.push(buttonHtml(input.button.label, input.button.url, t.accent))
  if (input.tip) {
    body.push(`
<tr><td style="padding:20px 0 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">${escapeHtml(input.tip)}</td></tr>`)
  }

  const footerLines = [input.footer.reason, isListhit ? (footerAddress ? `ListHit · ${footerAddress}` : "") : [t.name, footerAddress].filter(Boolean).join(" · ")]
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .join("<br />")

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(input.heading)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
  img { -ms-interpolation-mode:bicubic; }
  a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
  @media only screen and (max-width:480px) {
    .container { width:100% !important; }
    .outer { padding:16px 8px !important; }
    .px { padding-left:20px !important; padding-right:20px !important; }
    .h1 { font-size:20px !important; line-height:28px !important; }
    .btn-table, .btn-cell { width:100% !important; }
    .btn { display:block !important; text-align:center !important; }
    .dl, .dv { display:block !important; width:auto !important; }
    .dv { padding-top:0 !important; border-top:0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};" bgcolor="${PAGE_BG}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE_BG};">${escapeHtml(preheader)}${"&#8203;&nbsp;".repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};" bgcolor="${PAGE_BG}">
<tr><td align="center" style="padding:32px 16px;" class="outer">
  <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="container" style="max-width:560px;background-color:${CARD_BG};border:1px solid ${BORDER};border-radius:12px;border-collapse:separate;" bgcolor="${CARD_BG}">
    ${headerHtml(t, isListhit)}
    <tr><td style="padding:24px 32px 32px 32px;" class="px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body.join("")}
      </table>
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="container" style="max-width:560px;">
    <tr><td style="padding:20px 32px 0 32px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};text-align:center;" class="px">${footerLines}</td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`

  return { html, text: renderText(input, t, footerAddress) }
}

function renderText(input: EmailInput, t: ResolvedTheme, footerAddress: string): string {
  const out: string[] = []
  if (input.eyebrow) out.push(input.eyebrow.text.toUpperCase(), "")
  out.push(input.heading, "")
  for (const p of input.paragraphs) out.push(p, "")
  if (input.list?.length) {
    for (const item of input.list) out.push(`- ${item}`)
    out.push("")
  }
  if (input.details?.length) {
    for (const d of input.details) out.push(`${d.label}: ${d.value}`)
    out.push("")
  }
  if (input.button) out.push(`${input.button.label}: ${safeUrl(input.button.url)}`, "")
  if (input.tip) out.push(input.tip, "")
  out.push("--", input.footer.reason)
  const isListhit = input.theme === "listhit"
  const sig = isListhit ? (footerAddress ? `ListHit · ${footerAddress}` : "") : [t.name, footerAddress].filter(Boolean).join(" · ")
  if (sig) out.push(sig)
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
}

// Shared footer for platform (ListHit-theme) emails.
export function listhitFooter(business?: string | null): EmailInput["footer"] {
  const who = (business || "").trim()
  return {
    reason: who
      ? `You're getting this because you have a ListHit account for ${who}.`
      : "You're getting this because you have a ListHit account.",
    address: (process.env.LISTHIT_MAILING_ADDRESS || "").trim() || undefined,
  }
}
