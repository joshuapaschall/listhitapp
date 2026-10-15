// renderEmail + every template built on it: escaping, preheader, button links
// in both versions, tenant theming, and no carrier/infrastructure jargon.

import { LISTHIT_RED, renderEmail } from "@/lib/email/layout"
import { sampleEmails } from "@/lib/email/samples"
import { DEFAULT_BRAND } from "@/lib/email-templates/brand"

const base = {
  theme: "listhit" as const,
  preheader: "Your number is approved. Text your buyers now.",
  heading: "Texting is live",
  paragraphs: ["You can text buyers now."],
  footer: { reason: "You're getting this because you have a ListHit account." },
}

describe("renderEmail", () => {
  test("escapes every input — no raw HTML gets through", () => {
    const { html, text } = renderEmail({
      ...base,
      heading: `<script>alert("x")</script> & co`,
      paragraphs: [`<img src=x onerror=alert(1)>`],
      details: [{ label: "<b>Label</b>", value: `"quoted" & 'single'` }],
      list: ["<a href='evil'>click</a>"],
      tip: "<i>tip</i>",
    })
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("<img src=x")
    expect(html).not.toContain("<a href='evil'>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&quot;quoted&quot; &amp; &#39;single&#39;")
    // Plain text is plain: the raw characters, no entities.
    expect(text).toContain(`<script>alert("x")</script> & co`)
  })

  test("hidden preheader is present and capped at 110 chars", () => {
    const long = "x".repeat(200)
    const { html } = renderEmail({ ...base, preheader: long })
    expect(html).toMatch(/<div style="display:none;[^"]*">x{110}&#8203;/)
    expect(html).not.toContain("x".repeat(111))
    expect(renderEmail(base).html).toContain(base.preheader)
  })

  test("button URL appears in the html (button + copy link) and the text version", () => {
    const url = "https://app.listhit.io/campaigns/new"
    const { html, text } = renderEmail({ ...base, button: { label: "Send your first deal", url } })
    expect(html.match(new RegExp(`href="${url}"`, "g"))?.length).toBeGreaterThanOrEqual(2)
    expect(html).toContain("v:roundrect") // Outlook VML fallback
    expect(html).toContain("Or copy this link")
    expect(text).toContain(`Send your first deal: ${url}`)
  })

  test("unsafe URLs never reach an href", () => {
    const { html } = renderEmail({ ...base, button: { label: "Go", url: "javascript:alert(1)" } })
    expect(html).not.toContain("javascript:")
  })

  test("details render as label/value rows; text as 'Label: value'", () => {
    const { text } = renderEmail({ ...base, details: [{ label: "Your number", value: "(404) 555-0123" }] })
    expect(text).toContain("Your number: (404) 555-0123")
  })

  test("dark-mode meta tags and the ListHit header", () => {
    const { html } = renderEmail(base)
    expect(html).toContain('<meta name="color-scheme" content="light dark" />')
    expect(html).toContain('<meta name="supported-color-schemes" content="light dark" />')
    expect(html).toContain("https://app.listhit.io/brand/icon.png")
    expect(html).toContain(">ListHit</td>")
    expect(html).toContain("max-width:560px")
  })

  test("tenant theme uses the tenant's name and primary color, not ListHit's", () => {
    const brand = { ...DEFAULT_BRAND, companyName: "Acme Homes", colors: { ...DEFAULT_BRAND.colors, navy: "#0F766E" } }
    const { html } = renderEmail({ ...base, theme: { brand }, button: { label: "View", url: "https://acme.example" } })
    expect(html).toContain("Acme Homes")
    expect(html).toContain("background-color:#0F766E")
    expect(html).not.toContain(`background-color:${LISTHIT_RED}`)
    expect(html).not.toContain("brand/icon.png")
  })

  test("ListHit footer address comes from LISTHIT_MAILING_ADDRESS and is omitted when unset", async () => {
    const { listhitFooter } = await import("@/lib/email/layout")
    delete process.env.LISTHIT_MAILING_ADDRESS
    expect(renderEmail({ ...base, footer: listhitFooter("Acme") }).text).not.toContain("ListHit ·")
    process.env.LISTHIT_MAILING_ADDRESS = "Atlanta, GA"
    const { text } = renderEmail({ ...base, footer: listhitFooter("Acme") })
    expect(text).toContain("You're getting this because you have a ListHit account for Acme.")
    expect(text).toContain("ListHit · Atlanta, GA")
    delete process.env.LISTHIT_MAILING_ADDRESS
  })
})

describe("every template", () => {
  const BANNED = /\b(A2P|10DLC|TCR|Trust ?Hub|TrustProduct|EndUser|subaccount)\b/i

  test.each(sampleEmails().map((e) => [e.name, e] as const))("%s: no banned words, has a subject and both versions", (_name, email) => {
    expect(email.subject.trim().length).toBeGreaterThan(0)
    expect(email.html).toContain("<!DOCTYPE html>")
    expect(email.subject).not.toMatch(BANNED)
    expect(email.html).not.toMatch(BANNED)
    expect(email.text).not.toMatch(BANNED)
  })

  test("buyer-facing templates use the tenant theme", () => {
    for (const e of sampleEmails().filter((x) => x.audience === "buyer")) {
      expect(e.html).toContain("Every State House Buyers")
      expect(e.html).not.toContain("brand/icon.png")
    }
  })
})
