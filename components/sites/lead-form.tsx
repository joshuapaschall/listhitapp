"use client"
import React, { useEffect, useState } from "react"
import { useSiteForm } from "@/lib/site-builder/site-context"
import { getPersonaForm, propertyTypeChoices, BUYER_TYPE_OPTIONS, PAYMENT_OPTIONS, PRICE_BANDS } from "@/lib/site-builder/persona-form"
import type { BuyerTypeKey, PaymentKey } from "@/lib/buyer-taxonomy"

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
    if (step === "done") {
      onComplete?.()
      // Notify the owner's ad tags (SiteAnalytics) so the conversion fires
      // regardless of which parent rendered this form.
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("lh:lead"))
    }
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
        className={inline ? "lh-form-2" : undefined}
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
