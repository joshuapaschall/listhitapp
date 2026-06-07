import React, { useEffect, useState } from "react"
import type { Config } from "@measured/puck"
import { themeToCssVars } from "../theme"
import { useSiteForm } from "../site-context"
import {
  getPersonaForm,
  propertyTypeChoices,
  BUYER_TYPE_OPTIONS,
  PAYMENT_OPTIONS,
  PRICE_BANDS,
} from "../persona-form"
import type { BuyerTypeKey, PaymentKey } from "@/lib/buyer-taxonomy"
import { DealCard } from "@/components/sites/deal-card"

// ---------------------------------------------------------------------------
// Shared primitives — every block is self-contained and token-driven. Styling
// reads the CSS variables --p (primary), --a (accent), --head (heading font)
// that Root sets, so this config renders identically in the dashboard editor
// and in the standalone public site app. No Tailwind, no globals.css.
// ---------------------------------------------------------------------------

const WRAP: React.CSSProperties = { maxWidth: 1120, margin: "0 auto", padding: "0 24px" }

// A self-contained lead capture form. Kept above the fold in every hero variant.
const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #d7dde4",
  fontSize: 15,
  outline: "none",
  background: "#fff",
  color: "#0f1b29",
}

const primaryBtn: React.CSSProperties = {
  marginTop: 12,
  width: "100%",
  padding: "13px 16px",
  borderRadius: 10,
  border: "none",
  background: "var(--a)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15.5,
  cursor: "pointer",
}

// Multi-select chip row.
function Chips({
  options,
  selected,
  onToggle,
}: {
  options: { key: string; label: string }[]
  selected: string[]
  onToggle: (key: string) => void
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {options.map((o) => {
        const active = selected.includes(o.key)
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onToggle(o.key)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              border: active ? "1px solid var(--p)" : "1px solid #d7dde4",
              background: active ? "var(--p)" : "#fff",
              color: active ? "#fff" : "#3a4554",
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0f1b29", marginTop: 16 }}>{children}</div>
}

// Render the opt-in disclosure with the trailing "Terms of Use and Privacy
// Policy" turned into real links.
function renderDisclosure(text: string, terms: string, privacy: string): React.ReactNode {
  const marker = "Terms of Use and Privacy Policy"
  const idx = text.lastIndexOf(marker)
  if (idx < 0) return text
  const linkStyle: React.CSSProperties = { color: "var(--p)", textDecoration: "underline" }
  return (
    <>
      {text.slice(0, idx)}
      <a href={terms} style={linkStyle}>Terms of Use</a>
      {" and "}
      <a href={privacy} style={linkStyle}>Privacy Policy</a>
    </>
  )
}

// Two-step buyer lead form. Step 1 captures contact + TCPA consent and posts to
// the public signup endpoint; Step 2 captures persona-driven qualification and
// dedup-merges into the same buyer. Posts same-origin; org is resolved by the
// endpoint from the request Origin.
export function LeadForm({
  title,
  subtitle,
  ctaLabel,
  inline,
  onComplete,
}: {
  title?: string
  subtitle?: string
  ctaLabel?: string
  inline?: boolean
  onComplete?: () => void
}) {
  const form = useSiteForm()
  const cfg = getPersonaForm(form.persona)
  const propChoices = propertyTypeChoices(cfg)
  const hidePropControl = propChoices.length === 1
  const buyerTypeOpts = BUYER_TYPE_OPTIONS.filter((o) => cfg.buyerTypeKeys.includes(o.key))
  const paymentOpts = PAYMENT_OPTIONS.filter((o) => cfg.paymentKeys.includes(o.key))

  const [step, setStep] = useState<"contact" | "qualify" | "done">("contact")
  useEffect(() => {
    if (step === "done") onComplete?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])
  const [fname, setFname] = useState("")
  const [lname, setLname] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [consent, setConsent] = useState(false) // TCPA: always starts UNCHECKED
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const [buyerTypes, setBuyerTypes] = useState<string[]>([])
  const [payments, setPayments] = useState<string[]>([])
  const [propertyTypes, setPropertyTypes] = useState<string[]>(() => (hidePropControl ? [propChoices[0]] : []))
  const [locations, setLocations] = useState<string[]>([])
  const [priceIdx, setPriceIdx] = useState<number | null>(null)
  const [locQuery, setLocQuery] = useState("")
  const [locResults, setLocResults] = useState<string[]>([])

  useEffect(() => {
    const q = locQuery.trim()
    if (q.length < 2) {
      setLocResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/public/locations?q=${encodeURIComponent(q)}`, { credentials: "omit" })
        const data = await res.json().catch(() => ({}))
        if (data?.ok && Array.isArray(data.results)) setLocResults(data.results)
      } catch {
        /* ignore typeahead errors */
      }
    }, 250)
    return () => clearTimeout(t)
  }, [locQuery])

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, key: string) =>
    setter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const addLocation = (loc: string) => {
    setLocations((prev) => (prev.includes(loc) ? prev : [...prev, loc]))
    setLocQuery("")
    setLocResults([])
  }

  function basePayload() {
    return {
      fname,
      lname: lname || undefined,
      email,
      phone,
      // consent_text is always the generated disclosure (endpoint requires >=50
      // chars) — sent even when the visible checkbox is disabled.
      consent_text: form.disclosure,
      source_url: typeof window !== "undefined" ? window.location.href : undefined,
    }
  }

  async function post(payload: Record<string, any>): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch("/api/public/buyers/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: data?.message || data?.error || "Submission failed" }
      return { ok: true }
    } catch {
      return { ok: false, error: "Network error. Please try again." }
    }
  }

  const contactValid =
    fname.trim().length > 0 &&
    phone.trim().length > 0 &&
    email.trim().length > 0 &&
    (!form.requireConsent || consent)

  async function submitContact() {
    if (!contactValid) {
      setError("Please add your name, phone, and email" + (form.requireConsent ? ", and agree to the terms." : "."))
      return
    }
    setSubmitting(true)
    setError("")
    const r = await post(basePayload())
    setSubmitting(false)
    if (r.ok) setStep("qualify")
    else setError(r.error || "Something went wrong. Please try again.")
  }

  async function submitQualify() {
    const band = priceIdx != null ? PRICE_BANDS[priceIdx] : null
    const hasData =
      buyerTypes.length > 0 ||
      payments.length > 0 ||
      locations.length > 0 ||
      propertyTypes.length > 0 ||
      Boolean(band)
    if (!hasData) {
      setStep("done")
      return
    }
    setSubmitting(true)
    setError("")
    const r = await post({
      ...basePayload(),
      buyer_types: buyerTypes as BuyerTypeKey[],
      payment_methods: payments as PaymentKey[],
      property_types: propertyTypes,
      locations,
      asking_price_min: band?.min,
      asking_price_max: band?.max,
    })
    setSubmitting(false)
    if (r.ok) setStep("done")
    else setError(r.error || "Something went wrong. Please try again.")
  }

  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 18px 40px rgba(16,27,41,.16)",
    border: "1px solid #eef1f5",
    padding: 20,
    width: "100%",
    maxWidth: inline ? "none" : 420,
  }

  if (step === "done") {
    return (
      <div style={card}>
        <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 22, color: "var(--p)" }}>
          You&apos;re on the list 🎉
        </div>
        <p style={{ fontSize: 14.5, color: "#5a6675", marginTop: 8, lineHeight: 1.5 }}>
          Check your phone and email — we&apos;ll send new deals as soon as they hit. Reply STOP anytime to opt out.
        </p>
      </div>
    )
  }

  if (step === "qualify") {
    return (
      <div style={card}>
        <div style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 19, color: "#0f1b29" }}>
          A few quick details
        </div>
        <div style={{ fontSize: 13.5, color: "#5a6675", marginTop: 4 }}>
          Tell us what you want so we only send deals that fit.
        </div>

        {cfg.showBuyerTypes && buyerTypeOpts.length > 0 && (
          <>
            <FieldLabel>{cfg.buyerTypeQuestion || "What kind of buyer are you?"}</FieldLabel>
            <Chips options={buyerTypeOpts} selected={buyerTypes} onToggle={(k) => toggle(setBuyerTypes, k)} />
          </>
        )}

        {cfg.showPayments && paymentOpts.length > 0 && (
          <>
            <FieldLabel>How are you buying?</FieldLabel>
            <Chips options={paymentOpts} selected={payments} onToggle={(k) => toggle(setPayments, k)} />
          </>
        )}

        {!hidePropControl && (
          <>
            <FieldLabel>Property types</FieldLabel>
            <Chips
              options={propChoices.map((p) => ({ key: p, label: p }))}
              selected={propertyTypes}
              onToggle={(k) => toggle(setPropertyTypes, k)}
            />
          </>
        )}

        <FieldLabel>Where do you want deals?</FieldLabel>
        {locations.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {locations.map((loc) => (
              <span
                key={loc}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "color-mix(in srgb, var(--p) 10%, #fff)",
                  color: "var(--p)",
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                {loc}
                <span
                  role="button"
                  onClick={() => setLocations((prev) => prev.filter((l) => l !== loc))}
                  style={{ cursor: "pointer" }}
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
        <div style={{ position: "relative", marginTop: 8 }}>
          <input
            style={fieldStyle}
            placeholder="City, county, or state"
            value={locQuery}
            onChange={(e) => setLocQuery(e.target.value)}
            aria-label="Search locations"
          />
          {locResults.length > 0 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "100%",
                zIndex: 20,
                marginTop: 4,
                background: "#fff",
                border: "1px solid #e5e9ef",
                borderRadius: 10,
                boxShadow: "0 12px 30px rgba(16,27,41,.14)",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {locResults.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => addLocation(r)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "#0f1b29",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        <FieldLabel>Price range</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {PRICE_BANDS.map((b, i) => {
            const active = priceIdx === i
            return (
              <button
                key={b.label}
                type="button"
                onClick={() => setPriceIdx(active ? null : i)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: active ? "1px solid var(--p)" : "1px solid #d7dde4",
                  background: active ? "var(--p)" : "#fff",
                  color: active ? "#fff" : "#3a4554",
                }}
              >
                {b.label}
              </button>
            )
          })}
        </div>

        {error && <div style={{ color: "#b42318", fontSize: 13, marginTop: 12 }}>{error}</div>}

        <button type="button" style={primaryBtn} onClick={submitQualify} disabled={submitting}>
          {submitting ? "Saving…" : "Show me the deals"}
        </button>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <span
            role="button"
            onClick={() => setStep("done")}
            style={{ fontSize: 13, color: "#8a94a2", cursor: "pointer", textDecoration: "underline" }}
          >
            Skip for now
          </span>
        </div>
      </div>
    )
  }

  // step === "contact"
  return (
    <div style={card}>
      {title && (
        <div style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 19, color: "#0f1b29" }}>{title}</div>
      )}
      {subtitle && <div style={{ fontSize: 13.5, color: "#5a6675", marginTop: 4 }}>{subtitle}</div>}
      <div
        style={{
          display: inline ? "grid" : "block",
          gridTemplateColumns: inline ? "1fr 1fr" : undefined,
          gap: 10,
          marginTop: 14,
        }}
      >
        <input style={fieldStyle} placeholder="First name" aria-label="First name" value={fname} onChange={(e) => setFname(e.target.value)} />
        <input style={fieldStyle} placeholder="Last name" aria-label="Last name" value={lname} onChange={(e) => setLname(e.target.value)} />
        <input style={{ ...fieldStyle, gridColumn: inline ? "1 / -1" : undefined }} placeholder="Mobile phone" aria-label="Mobile phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input style={{ ...fieldStyle, gridColumn: inline ? "1 / -1" : undefined }} placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      {form.optinEnabled && form.disclosure && (
        <div style={{ marginTop: 12 }}>
          {form.requireConsent && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 3 }}
                aria-label="Agree to receive text messages"
              />
              <span style={{ fontSize: 11.5, color: "#5a6675", lineHeight: 1.45 }}>
                {renderDisclosure(form.disclosure, form.legalPaths.terms, form.legalPaths.privacy)}
              </span>
            </label>
          )}
          {!form.requireConsent && (
            <div style={{ fontSize: 11.5, color: "#5a6675", lineHeight: 1.45 }}>
              {renderDisclosure(form.disclosure, form.legalPaths.terms, form.legalPaths.privacy)}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ color: "#b42318", fontSize: 13, marginTop: 12 }}>{error}</div>}

      <button
        type="button"
        style={{ ...primaryBtn, opacity: !contactValid || submitting ? 0.6 : 1 }}
        onClick={submitContact}
        disabled={!contactValid || submitting}
      >
        {submitting ? "Submitting…" : ctaLabel || "Get started"}
      </button>
      <div style={{ fontSize: 11.5, color: "#8a94a2", marginTop: 9, textAlign: "center" }}>
        No spam. Reply STOP anytime.
      </div>
    </div>
  )
}

const HEADING: React.CSSProperties = { fontFamily: "var(--head)", lineHeight: 1.05, letterSpacing: "-.01em" }

// Property grid section — reads the org's real deals from site context. A real
// component (uppercase) so the hook obeys rules-of-hooks.
function DealsSection({ heading }: { heading?: string }) {
  const { deals } = useSiteForm()
  return (
    <section style={{ background: "color-mix(in srgb, var(--p) 5%, #fff)" }}>
      <div style={{ ...WRAP, padding: "64px 24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", margin: 0 }}>{heading}</h2>
        </div>
        {deals.length > 0 ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
              {deals.slice(0, 6).map((d) => (
                <DealCard key={d.id} property={d} variant="teaser" />
              ))}
            </div>
            <div style={{ marginTop: 24, textAlign: "right" }}>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
              <a href="/properties" style={{ color: "var(--p)", fontWeight: 700, textDecoration: "none", fontSize: 14.5 }}>
                View all deals →
              </a>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14.5, color: "#8a94a2", padding: "8px 0" }}>
            Your published deals will appear here.
          </div>
        )}
      </div>
    </section>
  )
}

// Footer "Serving …" line, read from the site's market focus via context.
function socialHref(v: string) {
  return v.startsWith("http") ? v : `https://${v}`
}

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  facebook: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M14 9h3l.5-3H14V4.5c0-.9.3-1.5 1.6-1.5H18V.2C17.5.1 16.4 0 15.3 0 12.8 0 11 1.5 11 4.3V6H8v3h3v9h3V9z"/></svg>,
  instagram: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>,
  youtube: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M23 12s0-3.5-.4-5.2c-.2-.9-.9-1.6-1.8-1.8C19 4.5 12 4.5 12 4.5s-7 0-8.8.5c-.9.2-1.6.9-1.8 1.8C1 8.5 1 12 1 12s0 3.5.4 5.2c.2.9.9 1.6 1.8 1.8 1.8.5 8.8.5 8.8.5s7 0 8.8-.5c.9-.2 1.6-.9 1.8-1.8.4-1.7.4-5.2.4-5.2zM9.7 15.5v-7l6 3.5-6 3.5z"/></svg>,
  linkedin: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.1c.5-.9 1.8-1.9 3.6-1.9 3.9 0 4.6 2.5 4.6 5.8V21h-4v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z"/></svg>,
  tiktok: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 3c.3 2.1 1.5 3.6 3.5 3.8v2.4c-1.2 0-2.4-.4-3.5-1.1V15a5.5 5.5 0 1 1-5.5-5.5c.3 0 .6 0 .9.1v2.5a3 3 0 1 0 2.1 2.9V3H16z"/></svg>,
}

function SiteFooter({ text }: { text?: string }) {
  const { brandName, markets, business, legalPaths } = useSiteForm()
  const serving =
    markets.scope === "nationwide" || markets.markets.length === 0
      ? "Serving buyers nationwide"
      : `Serving ${markets.markets.slice(0, 6).join(" · ")}`
  const socials = (Object.keys(SOCIAL_ICONS) as Array<keyof typeof business.social>)
    .map((k) => ({ k, v: (business.social as any)[k] as string | undefined }))
    .filter((s) => s.v && s.v.trim().length > 0)
  const year = new Date().getFullYear()
  const copyright = text && text.trim().length > 0 ? text : `© ${year} ${brandName}. All rights reserved.`
  const colHead: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "#0f1b29", marginBottom: 12 }
  const link: React.CSSProperties = { color: "#5a6675", textDecoration: "none", fontSize: 14, display: "block", marginBottom: 8 }

  return (
    <footer style={{ borderTop: "1px solid #eef1f5", background: "#fff" }}>
      <div style={{ ...WRAP, padding: "48px 24px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32 }}>
          {/* Brand */}
          <div>
            <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 20, color: "var(--p)" }}>{brandName}</div>
            <div style={{ fontSize: 13.5, color: "#8a94a2", marginTop: 8 }}>{serving}</div>
            {socials.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                {socials.map((s) => (
                  <a key={s.k} href={socialHref(s.v as string)} target="_blank" rel="noreferrer"
                     aria-label={s.k}
                     style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid #e4e8ee", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--p)" }}>
                    {SOCIAL_ICONS[s.k as string]}
                  </a>
                ))}
              </div>
            )}
          </div>
          {/* Explore */}
          <div>
            <div style={colHead}>Explore</div>
            {/* eslint-disable @next/next/no-html-link-for-pages */}
            <a href="/" style={link}>Home</a>
            <a href="/properties" style={link}>Deals</a>
            <a href="/contact" style={link}>Contact</a>
            {/* eslint-enable @next/next/no-html-link-for-pages */}
          </div>
          {/* Legal */}
          <div>
            <div style={colHead}>Legal</div>
            {/* eslint-disable @next/next/no-html-link-for-pages */}
            <a href={legalPaths.privacy} style={link}>Privacy Policy</a>
            <a href={legalPaths.terms} style={link}>Terms of Use</a>
            {/* eslint-enable @next/next/no-html-link-for-pages */}
          </div>
          {/* Contact */}
          {(business.phone || business.email) && (
            <div>
              <div style={colHead}>Get in touch</div>
              {business.phone && <a href={`tel:${business.phone}`} style={link}>{business.phone}</a>}
              {business.email && <a href={`mailto:${business.email}`} style={link}>{business.email}</a>}
            </div>
          )}
        </div>
        <div style={{ borderTop: "1px solid #f1f4f8", marginTop: 32, paddingTop: 20, fontSize: 13, color: "#8a94a2" }}>
          {copyright}
        </div>
      </div>
    </footer>
  )
}

export const siteConfig: Config = {
  root: {
    fields: {
      primary: { type: "text" },
      accent: { type: "text" },
      headingFont: { type: "text" },
      bodyFont: { type: "text" },
    },
    defaultProps: {
      primary: "#173b5e",
      accent: "#e8833a",
      headingFont: "'Bricolage Grotesque', serif",
      bodyFont: "'Source Sans 3', sans-serif",
    },
    render: ({ primary, accent, headingFont, bodyFont, children }: any) => (
      <div
        style={{
          ...themeToCssVars({
            primary: primary || "#0f2a43",
            accent: accent || "#f5a623",
            headingFont: headingFont || "'Montserrat', sans-serif",
            bodyFont: bodyFont || "'Source Sans 3', sans-serif",
          }),
          fontFamily: "var(--body)",
          color: "#0f1b29",
          background: "#fff",
        }}
      >
        {children}
      </div>
    ),
  },

  components: {
    // -----------------------------------------------------------------------
    Nav: {
      label: "Nav",
      fields: {
        brandName: { type: "text" },
        logoUrl: { type: "text" },
        phone: { type: "text" },
        links: { type: "array", arrayFields: { label: { type: "text" }, href: { type: "text" } } },
        layout: {
          type: "select",
          options: [
            { label: "Split", value: "split" },
            { label: "Center", value: "center" },
            { label: "Stack", value: "stack" },
          ],
        },
      },
      defaultProps: {
        brandName: "Your Company",
        logoUrl: "",
        phone: "(555) 555-5555",
        links: [{ label: "Deals", href: "/properties" }, { label: "Contact", href: "/contact" }],
        layout: "split",
      },
      render: ({ brandName, logoUrl, phone, links, layout }: any) => {
        const isCenter = layout === "center"
        const isStack = layout === "stack"
        const brand = (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} style={{ height: 30 }} />
            ) : null}
            <span style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 20, color: "var(--p)" }}>
              {brandName}
            </span>
          </div>
        )
        const linkRow = (
          <nav style={{ display: "flex", gap: 22, alignItems: "center" }}>
            {(links || []).map((l: any, i: number) => (
              // eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site
              <a key={i} href={l?.href || "#"} style={{ color: "#3a4554", textDecoration: "none", fontSize: 14.5 }}>
                {l?.label}
              </a>
            ))}
            {phone && (
              <a
                href={`tel:${phone}`}
                style={{ color: "var(--p)", fontWeight: 700, textDecoration: "none", fontSize: 14.5 }}
              >
                {phone}
              </a>
            )}
          </nav>
        )
        return (
          <header style={{ borderBottom: "1px solid #eef1f5", background: "#fff" }}>
            <div
              style={{
                ...WRAP,
                display: "flex",
                flexDirection: isStack ? "column" : "row",
                alignItems: "center",
                justifyContent: isCenter ? "center" : "space-between",
                gap: 12,
                padding: "16px 24px",
                textAlign: isCenter ? "center" : "left",
              }}
            >
              {brand}
              {linkRow}
            </div>
          </header>
        )
      },
    },

    // -----------------------------------------------------------------------
    Hero: {
      label: "Hero",
      fields: {
        variant: {
          type: "select",
          options: [
            { label: "Photo", value: "photo" },
            { label: "Centered", value: "centered" },
            { label: "Split", value: "split" },
            { label: "Band", value: "band" },
          ],
        },
        eyebrow: { type: "text" },
        headline: { type: "textarea" },
        subhead: { type: "textarea" },
        stat: { type: "text" },
        imageUrl: { type: "text" },
        formTitle: { type: "text" },
        formSubtitle: { type: "text" },
        ctaLabel: { type: "text" },
      },
      defaultProps: {
        variant: "photo",
        eyebrow: "Trusted local buyer",
        headline: "Sell your house fast — for cash",
        subhead: "Get a fair, no-obligation cash offer in 24 hours.",
        stat: "500+ homes purchased",
        imageUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600",
        formTitle: "Get your cash offer",
        formSubtitle: "Takes 60 seconds.",
        ctaLabel: "Get my offer",
      },
      render: ({ variant, eyebrow, headline, subhead, stat, imageUrl, formTitle, formSubtitle, ctaLabel }: any) => {
        const eyebrowEl = eyebrow ? (
          <div
            style={{
              display: "inline-block",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--a)",
              marginBottom: 12,
            }}
          >
            {eyebrow}
          </div>
        ) : null

        const h = (color: string) => (
          <h1 style={{ ...HEADING, fontSize: 44, fontWeight: 800, color, margin: 0 }}>{headline}</h1>
        )
        const sub = (color: string) => (
          <p style={{ fontSize: 18, lineHeight: 1.5, color, marginTop: 14, maxWidth: 520 }}>{subhead}</p>
        )

        if (variant === "photo") {
          return (
            <section
              style={{
                backgroundImage: `linear-gradient(90deg, rgba(11,22,36,.78), rgba(11,22,36,.35)), url(${imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div
                style={{
                  ...WRAP,
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) minmax(280px,400px)",
                  gap: 40,
                  alignItems: "center",
                  padding: "76px 24px",
                }}
              >
                <div>
                  {eyebrowEl}
                  {h("#fff")}
                  {sub("rgba(255,255,255,.88)")}
                  {stat && <div style={{ marginTop: 18, color: "#fff", fontWeight: 700 }}>★ {stat}</div>}
                </div>
                <LeadForm title={formTitle} subtitle={formSubtitle} ctaLabel={ctaLabel} />
              </div>
            </section>
          )
        }

        if (variant === "centered") {
          return (
            <section style={{ background: "color-mix(in srgb, var(--p) 7%, #fff)" }}>
              <div style={{ ...WRAP, padding: "72px 24px", textAlign: "center" }}>
                {eyebrowEl}
                <h1 style={{ ...HEADING, fontSize: 46, fontWeight: 800, color: "var(--p)", margin: "0 auto", maxWidth: 760 }}>
                  {headline}
                </h1>
                <p style={{ fontSize: 18, lineHeight: 1.5, color: "#42505f", margin: "14px auto 0", maxWidth: 600 }}>
                  {subhead}
                </p>
                <div style={{ maxWidth: 720, margin: "24px auto 0" }}>
                  <LeadForm title={formTitle} subtitle={formSubtitle} ctaLabel={ctaLabel} inline />
                </div>
              </div>
            </section>
          )
        }

        if (variant === "split") {
          return (
            <section style={{ background: "#fff" }}>
              <div
                style={{
                  ...WRAP,
                  display: "grid",
                  gridTemplateColumns: "minmax(280px,400px) minmax(0,1fr)",
                  gap: 40,
                  alignItems: "center",
                  padding: "64px 24px",
                }}
              >
                <div>
                  {eyebrowEl}
                  {h("var(--p)")}
                  {sub("#42505f")}
                  <div style={{ marginTop: 20 }}>
                    <LeadForm title={formTitle} subtitle={formSubtitle} ctaLabel={ctaLabel} />
                  </div>
                </div>
                <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", minHeight: 360 }}>
                  <img
                    src={imageUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 360 }}
                  />
                  {stat && (
                    <div
                      style={{
                        position: "absolute",
                        left: 18,
                        bottom: 18,
                        background: "rgba(11,22,36,.82)",
                        color: "#fff",
                        padding: "10px 14px",
                        borderRadius: 12,
                        fontWeight: 700,
                      }}
                    >
                      ★ {stat}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        }

        // band
        return (
          <section>
            <div style={{ background: "var(--p)" }}>
              <div
                style={{
                  ...WRAP,
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) minmax(280px,420px)",
                  gap: 36,
                  alignItems: "center",
                  padding: "56px 24px",
                }}
              >
                <div>
                  {eyebrow && (
                    <div style={{ color: "var(--a)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", fontSize: 13, marginBottom: 10 }}>
                      {eyebrow}
                    </div>
                  )}
                  {h("#fff")}
                  {sub("rgba(255,255,255,.86)")}
                  {stat && <div style={{ marginTop: 16, color: "#fff", fontWeight: 700 }}>★ {stat}</div>}
                </div>
                <LeadForm title={formTitle} subtitle={formSubtitle} ctaLabel={ctaLabel} />
              </div>
            </div>
          </section>
        )
      },
    },

    // -----------------------------------------------------------------------
    TrustBar: {
      label: "Trust bar",
      fields: {
        items: { type: "array", arrayFields: { label: { type: "text" } } },
      },
      defaultProps: {
        items: [{ label: "A+ BBB rated" }, { label: "Cash in 7 days" }, { label: "No fees, no commissions" }, { label: "500+ 5-star reviews" }],
      },
      render: ({ items }: any) => (
        <div style={{ background: "var(--p)" }}>
          <div
            style={{
              ...WRAP,
              display: "flex",
              flexWrap: "wrap",
              gap: 28,
              justifyContent: "center",
              padding: "16px 24px",
            }}
          >
            {(items || []).map((it: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 14.5, fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--a)" }} />
                {it?.label}
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // -----------------------------------------------------------------------
    FeatureGrid: {
      label: "Feature grid",
      fields: {
        heading: { type: "text" },
        features: {
          type: "array",
          arrayFields: {
            icon: { type: "text" },
            title: { type: "text" },
            body: { type: "textarea" },
          },
        },
      },
      defaultProps: {
        heading: "Why homeowners choose us",
        features: [
          { icon: "⚡", title: "Close fast", body: "Pick your closing date — as quick as 7 days." },
          { icon: "💵", title: "Fair cash offer", body: "No lowballs. A real number you can count on." },
          { icon: "🛠️", title: "Sell as-is", body: "No repairs, no cleaning, no showings." },
        ],
      },
      render: ({ heading, features }: any) => (
        <section style={{ background: "#fff" }}>
          <div style={{ ...WRAP, padding: "64px 24px" }}>
            {heading && (
              <h2 style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", textAlign: "center", margin: "0 0 36px" }}>
                {heading}
              </h2>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
              {(features || []).map((f: any, i: number) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #eef1f5",
                    borderRadius: 16,
                    padding: 24,
                    boxShadow: "0 8px 24px rgba(16,27,41,.05)",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "color-mix(in srgb, var(--p) 12%, #fff)",
                      fontSize: 22,
                      marginBottom: 14,
                    }}
                  >
                    {f?.icon}
                  </div>
                  <div style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 18, color: "#0f1b29" }}>{f?.title}</div>
                  <p style={{ color: "#5a6675", fontSize: 14.5, lineHeight: 1.55, marginTop: 8 }}>{f?.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ),
    },

    // -----------------------------------------------------------------------
    PropertyGrid: {
      label: "Property grid",
      fields: {
        heading: { type: "text" },
      },
      defaultProps: { heading: "Recent deals" },
      render: ({ heading }: any) => <DealsSection heading={heading} />,
    },

    // -----------------------------------------------------------------------
    CtaBand: {
      label: "CTA band",
      fields: {
        heading: { type: "text" },
        body: { type: "textarea" },
        buttonLabel: { type: "text" },
      },
      defaultProps: {
        heading: "Ready for your offer?",
        body: "Tell us about your property and get a fair cash offer today.",
        buttonLabel: "Get my cash offer",
      },
      render: ({ heading, body, buttonLabel }: any) => (
        <section style={{ background: "var(--p)" }}>
          <div style={{ ...WRAP, padding: "56px 24px", textAlign: "center" }}>
            <h2 style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "#fff", margin: 0 }}>{heading}</h2>
            {body && <p style={{ color: "rgba(255,255,255,.85)", fontSize: 17, marginTop: 12, maxWidth: 560, marginInline: "auto" }}>{body}</p>}
            <button
              type="button"
              style={{
                marginTop: 22,
                padding: "14px 28px",
                borderRadius: 10,
                border: "none",
                background: "var(--a)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              {buttonLabel}
            </button>
          </div>
        </section>
      ),
    },

    // -----------------------------------------------------------------------
    Footer: {
      label: "Footer",
      fields: { text: { type: "text" } },
      defaultProps: { text: "" },
      render: ({ text }: any) => <SiteFooter text={text} />,
    },
  },
}
