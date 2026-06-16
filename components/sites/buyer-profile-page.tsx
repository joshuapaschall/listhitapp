"use client"
import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import { LocationPicker } from "@/components/sites/location-picker"
import {
  getPersonaForm,
  propertyTypeChoices,
  BUYER_TYPE_OPTIONS,
  PAYMENT_OPTIONS,
  PRICE_BANDS,
} from "@/lib/site-builder/persona-form"
import type { SiteTheme, SitePersona } from "@/lib/site-builder/types"

const LEAD_KEY = "lh_lead"

// Neutral surface palette (brand-agnostic; brand comes only from --p/--a tokens).
const INK = "#0f1b29"
const MUT = "#5a6675"
const LINE = "#e8ebf1"
const PAGE = "#f6f7f9"
const CHIP_BORDER = "#d9dee6"

type Lead = { fname?: string; phone?: string; email?: string; lname?: string }

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 4) return phone
  return `•••-•••-${digits.slice(-4)}`
}
function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return email
  return `${(local || "").slice(0, 1)}•••@${domain}`
}

function IconCheck({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconCircleCheck({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M7.5 12.4l3 3 6-6.4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconLock({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function BrandLockup({ logoUrl, brandName }: { logoUrl?: string; brandName: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={brandName} style={{ height: 32, maxHeight: 32, width: "auto", maxWidth: 180, objectFit: "contain", display: "block" }} />
  }
  return <span style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 18, color: "var(--p)" }}>{brandName}</span>
}

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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const active = selected.includes(o.key)
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onToggle(o.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 13px",
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
              border: active ? "1.5px solid var(--p)" : `1px solid ${CHIP_BORDER}`,
              background: active ? "color-mix(in srgb, var(--p) 8%, #fff)" : "#fff",
              color: active ? "var(--p)" : "#3a4554",
            }}
          >
            {active && <IconCheck />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SectionTitle({ n, title, helper }: { n: number; title: string; helper?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span
          style={{
            flexShrink: 0,
            width: 25,
            height: 25,
            borderRadius: 999,
            background: "var(--p)",
            color: "#fff",
            fontFamily: "var(--head)",
            fontWeight: 800,
            fontSize: 13,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {n}
        </span>
        <h2 style={{ fontFamily: "var(--head)", fontSize: 17, fontWeight: 700, color: INK, margin: 0 }}>{title}</h2>
      </div>
      {helper && <p style={{ margin: "5px 0 0 36px", fontSize: 12.5, color: MUT, lineHeight: 1.45 }}>{helper}</p>}
    </div>
  )
}

export function BuyerProfilePage({
  persona,
  brandName,
  theme,
  consentText,
}: {
  persona: SitePersona
  brandName: string
  theme: SiteTheme
  consentText: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cfg = getPersonaForm(persona)
  const buyerTypeOpts = BUYER_TYPE_OPTIONS.filter((o) => cfg.buyerTypeKeys.includes(o.key))
  const paymentOpts = PAYMENT_OPTIONS.filter((o) => cfg.paymentKeys.includes(o.key))
  const propChoices = propertyTypeChoices(cfg)
  const hidePropControl = propChoices.length === 1

  const [lead, setLead] = useState<Lead | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading")
  const [buyerTypes, setBuyerTypes] = useState<string[]>([])
  const [payments, setPayments] = useState<string[]>([])
  const [propertyTypes, setPropertyTypes] = useState<string[]>(() => (hidePropControl ? [propChoices[0]] : []))
  const [locations, setLocations] = useState<string[]>([])
  const [priceIdxs, setPriceIdxs] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Read the Step-1 contact from sessionStorage. If phone/email are missing
  // (direct hit, new tab, or expired session), show a graceful recovery screen
  // instead of silently bouncing. Consent lives at Step 1, so recovery sends
  // them back there to restart rather than re-collecting contact here.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LEAD_KEY)
      const parsed: Lead = raw ? JSON.parse(raw) : {}
      if (!parsed.phone || !parsed.email) {
        setStatus("missing")
        return
      }
      setLead(parsed)
      setStatus("ready")
    } catch {
      setStatus("missing")
    }
  }, [router])

  const fname = lead?.fname || searchParams.get("fname") || ""
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, key: string) =>
    setter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  function editContact() {
    try {
      sessionStorage.removeItem(LEAD_KEY)
    } catch {
      /* ignore */
    }
    router.push("/")
  }

  async function submit(skip: boolean) {
    if (!lead) return
    if (skip) {
      router.push(`/welcome?fname=${encodeURIComponent(fname)}`)
      return
    }
    setSubmitting(true)
    setError("")
    try {
      // Collapse the selected price bands into one overall [min, max] range. A
      // band with no min/max means "no floor"/"no ceiling", which widens the
      // range to open-ended on that side.
      let asking_price_min: number | undefined
      let asking_price_max: number | undefined
      if (priceIdxs.length > 0) {
        const bands = priceIdxs.map((i) => PRICE_BANDS[i])
        asking_price_min = bands.some((b) => b.min == null) ? undefined : Math.min(...bands.map((b) => b.min as number))
        asking_price_max = bands.some((b) => b.max == null) ? undefined : Math.max(...bands.map((b) => b.max as number))
      }
      const res = await fetch("/api/public/buyers/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          fname: lead.fname,
          lname: lead.lname || undefined,
          email: lead.email,
          phone: lead.phone,
          buyer_types: buyerTypes,
          property_types: propertyTypes,
          payment_methods: payments,
          locations,
          asking_price_min,
          asking_price_max,
          consent_text: consentText,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || data?.error || "Something went wrong. Please try again.")
      router.push(`/welcome?fname=${encodeURIComponent(fname)}`)
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.")
      setSubmitting(false)
    }
  }

  if (status === "missing") {
    return (
      <div style={{ ...themeToCssVars(theme), fontFamily: "var(--body)", color: INK, background: PAGE, minHeight: "100vh" }}>
        <SiteFonts typeStyleId={theme.typeStyleId} />
        <header style={{ background: "#fff", borderBottom: `1px solid ${LINE}` }}>
          <div style={{ maxWidth: 460, margin: "0 auto", padding: "13px 20px", display: "flex", justifyContent: "center" }}>
            <BrandLockup logoUrl={theme.logoUrl} brandName={brandName} />
          </div>
        </header>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--head)", fontSize: 23, fontWeight: 800, color: "var(--p)", margin: 0, letterSpacing: "-.01em" }}>
            Let&apos;s pick up where you left off
          </h1>
          <p style={{ fontSize: 14.5, color: MUT, margin: "10px 0 0", lineHeight: 1.55 }}>
            We couldn&apos;t find your details — it only takes a few seconds to start. Your spot on the list is one quick step away.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{ marginTop: 22, padding: "13px 24px", borderRadius: 12, border: "none", background: "var(--a)", color: "var(--a-ink)", fontFamily: "var(--head)", fontWeight: 800, fontSize: 15, cursor: "pointer" }}
          >
            Start over — it&apos;s quick →
          </button>
        </div>
      </div>
    )
  }

  if (status !== "ready" || !lead) {
    return (
      <div style={{ ...themeToCssVars(theme), minHeight: "100vh", background: PAGE }}>
        <SiteFonts typeStyleId={theme.typeStyleId} />
      </div>
    )
  }

  // Sequential step numbers across only the sections this persona shows.
  const sectionKeys: string[] = []
  const showBuyer = cfg.showBuyerTypes && buyerTypeOpts.length > 0
  const showPay = cfg.showPayments && paymentOpts.length > 0
  if (showBuyer) sectionKeys.push("buyer")
  if (!hidePropControl) sectionKeys.push("prop")
  sectionKeys.push("loc")
  if (showPay) sectionKeys.push("pay")
  sectionKeys.push("price")
  const stepNo = (k: string) => sectionKeys.indexOf(k) + 1

  const card: React.CSSProperties = {
    background: "#fff",
    border: `1px solid ${LINE}`,
    borderRadius: 14,
    padding: 18,
    marginTop: 12,
    boxShadow: "0 1px 2px rgba(16,27,41,.04)",
  }

  return (
    <div style={{ ...themeToCssVars(theme), fontFamily: "var(--body)", color: INK, background: PAGE, minHeight: "100vh" }}>
      <SiteFonts typeStyleId={theme.typeStyleId} />

      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 460, margin: "0 auto", padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <BrandLockup logoUrl={theme.logoUrl} brandName={brandName} />
          <span style={{ fontSize: 12, color: MUT }}>Step 2 of 2</span>
        </div>
      </header>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "26px 20px 56px" }}>
        <div style={{ height: 5, borderRadius: 999, background: "#e6eaf0", overflow: "hidden", marginBottom: 18 }}>
          <div style={{ width: "92%", height: "100%", background: "var(--a)" }} />
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--a-ink-light)" }}>
          Last step · 30 seconds
        </div>
        <h1 style={{ fontFamily: "var(--head)", fontSize: 26, fontWeight: 800, color: "var(--p)", margin: "8px 0 8px", letterSpacing: "-.01em", lineHeight: 1.14 }}>
          {fname ? `${fname}, let's match you to the right deals.` : "Let's match you to the right deals."}
        </h1>
        <p style={{ fontSize: 14.5, color: MUT, margin: 0, lineHeight: 1.55 }}>
          You&apos;re already on the list. This just sharpens what we send — so every text and email is a deal worth your time.
        </p>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, padding: "8px 13px", borderRadius: 999, background: "#fff", border: `1px solid ${LINE}`, fontSize: 12.5, color: MUT, flexWrap: "wrap" }}>
          <span style={{ color: "#1d9e75", display: "inline-flex" }}><IconCircleCheck /></span>
          <span>Sending to {maskPhone(lead.phone || "")} &amp; {maskEmail(lead.email || "")}</span>
          <span role="button" onClick={editContact} style={{ cursor: "pointer", fontWeight: 600, color: "var(--a-ink-light)", textDecoration: "underline" }}>Edit</span>
        </div>

        {showBuyer && (
          <div style={card}>
            <SectionTitle n={stepNo("buyer")} title={cfg.buyerTypeQuestion || "What kind of buyer are you?"} helper="Pick all that apply." />
            <Chips options={buyerTypeOpts} selected={buyerTypes} onToggle={(k) => toggle(setBuyerTypes, k)} />
          </div>
        )}

        {!hidePropControl && (
          <div style={card}>
            <SectionTitle n={stepNo("prop")} title="What you're after" helper="The property types you actually buy." />
            <Chips options={propChoices.map((p) => ({ key: p, label: p }))} selected={propertyTypes} onToggle={(k) => toggle(setPropertyTypes, k)} />
          </div>
        )}

        <div style={card}>
          <SectionTitle n={stepNo("loc")} title="Where you want deals" helper="Add any state, county, or city — we'll only send deals inside them." />
          <LocationPicker value={locations} onChange={setLocations} />
        </div>

        {showPay && (
          <div style={card}>
            <SectionTitle n={stepNo("pay")} title="How you close" helper="So we flag the deals that fit your money." />
            <Chips options={paymentOpts} selected={payments} onToggle={(k) => toggle(setPayments, k)} />
          </div>
        )}

        <div style={card}>
          <SectionTitle n={stepNo("price")} title="Your price range" helper="Pick any that fit — you can choose more than one." />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRICE_BANDS.map((b, i) => {
              const active = priceIdxs.includes(i)
              return (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setPriceIdxs((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 13px",
                    borderRadius: 999,
                    fontSize: 13.5,
                    fontWeight: 500,
                    cursor: "pointer",
                    border: active ? "1.5px solid var(--p)" : `1px solid ${CHIP_BORDER}`,
                    background: active ? "color-mix(in srgb, var(--p) 8%, #fff)" : "#fff",
                    color: active ? "var(--p)" : "#3a4554",
                  }}
                >
                  {active && <IconCheck />}
                  {b.label}
                </button>
              )
            })}
          </div>
        </div>

        {error && <div style={{ color: "#b42318", fontSize: 14, marginTop: 16 }}>{error}</div>}

        <button
          type="button"
          onClick={() => submit(false)}
          disabled={submitting}
          style={{
            marginTop: 22,
            width: "100%",
            padding: "15px",
            borderRadius: 12,
            border: "none",
            background: "var(--a)",
            color: "var(--a-ink)",
            fontFamily: "var(--head)",
            fontWeight: 800,
            fontSize: 16,
            cursor: "pointer",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Saving…" : "Start sending me deals →"}
        </button>
        <button
          type="button"
          onClick={() => submit(true)}
          style={{ display: "block", width: "100%", textAlign: "center", marginTop: 12, fontSize: 13.5, color: MUT, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
        >
          Skip for now — send me everything
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 11, fontSize: 11.5, color: MUT }}>
          <span style={{ display: "inline-flex" }}><IconLock /></span> You&apos;re in control. Reply STOP anytime.
        </div>
      </div>
    </div>
  )
}
