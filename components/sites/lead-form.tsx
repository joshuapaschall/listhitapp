"use client"
import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useSiteForm } from "@/lib/site-builder/site-context"

// Step 1 of the lead flow: a short contact card (name / phone / email + the
// two-checkbox consent). It POSTs to /api/public/buyers/signup immediately, so
// the lead is captured even if they never finish Step 2. On success it stashes
// the contact in sessionStorage and routes to the dedicated /get-on-the-list
// profile page (Step 2). PII (phone/email) is never put in the URL.
const LEAD_KEY = "lh_lead"

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
  color: "var(--a-ink)",
  fontWeight: 700,
  fontSize: 15.5,
  cursor: "pointer",
}

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
  const router = useRouter()

  const [fname, setFname] = useState("")
  const [lname, setLname] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  // Two-checkbox TCPA consent — both ALWAYS start unchecked, never pre-checked,
  // and never block submission.
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [nonMarketingConsent, setNonMarketingConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Consent is NEVER required to submit — the two checkboxes are optional and
  // only record opt-in preference.
  const contactValid = fname.trim().length > 0 && phone.trim().length > 0 && email.trim().length > 0

  async function submitContact() {
    if (!contactValid) {
      setError("Please add your name, phone, and email.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/public/buyers/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          fname,
          lname: lname || undefined,
          email,
          phone,
          consent_text: form.consentMarketing || form.disclosure,
          marketing_consent: marketingConsent,
          nonmarketing_consent: nonMarketingConsent,
          source_url: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Submission failed")
      }
    } catch (e: any) {
      setError(e?.message || "Network error. Please try again.")
      setSubmitting(false)
      return
    }

    // Lead captured. Stash contact (PII stays out of the URL) and hand off to
    // the dedicated Step-2 profile page.
    try {
      sessionStorage.setItem(LEAD_KEY, JSON.stringify({ fname, lname, phone, email }))
    } catch {
      /* sessionStorage unavailable — Step 2 falls back to home */
    }
    // Fire the conversion for the owner's ad tags (SiteAnalytics) regardless of
    // which parent rendered this form.
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("lh:lead"))
    onComplete?.()
    router.push(`/get-on-the-list?fname=${encodeURIComponent(fname)}`)
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

  return (
    <div style={card}>
      {title && (
        <div style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 19, color: "#0f1b29" }}>{title}</div>
      )}
      {subtitle && <div style={{ fontSize: 13.5, color: "#5a6675", marginTop: 4 }}>{subtitle}</div>}
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--p)", marginTop: 8, letterSpacing: "0.04em" }}>
        Step 1 of 2 · ~30 seconds
      </div>
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

      {/* Carrier-required two-checkbox consent: always shown, never pre-checked,
          optional (does not block submit). */}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            style={{ marginTop: 3 }}
            aria-label="Agree to receive marketing text messages"
          />
          <span style={{ fontSize: 11.5, color: "#5a6675", lineHeight: 1.45 }}>{form.consentMarketing}</span>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={nonMarketingConsent}
            onChange={(e) => setNonMarketingConsent(e.target.checked)}
            style={{ marginTop: 3 }}
            aria-label="Agree to receive non-marketing text messages"
          />
          <span style={{ fontSize: 11.5, color: "#5a6675", lineHeight: 1.45 }}>{form.consentNonMarketing}</span>
        </label>
        <div style={{ fontSize: 11.5, color: "#5a6675", lineHeight: 1.45 }}>
          <a href={form.legalPaths.terms} style={{ color: "var(--p)", textDecoration: "underline" }}>Terms of Use</a>
          {" and "}
          <a href={form.legalPaths.privacy} style={{ color: "var(--p)", textDecoration: "underline" }}>Privacy Policy</a>
        </div>
      </div>

      {error && <div style={{ color: "#b42318", fontSize: 13, marginTop: 12 }}>{error}</div>}

      <button
        type="button"
        style={{ ...primaryBtn, opacity: !contactValid || submitting ? 0.6 : 1 }}
        onClick={submitContact}
        disabled={!contactValid || submitting}
      >
        {submitting ? "Submitting…" : ctaLabel || "Get Deals →"}
      </button>
      <div style={{ fontSize: 11.5, color: "#5a6675", marginTop: 9, textAlign: "center" }}>
        No spam. Reply STOP anytime.
      </div>
    </div>
  )
}
