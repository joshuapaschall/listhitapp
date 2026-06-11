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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {options.map((o) => {
        const active = selected.includes(o.key)
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onToggle(o.key)}
            style={{
              padding: "12px 18px",
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              border: active ? "2px solid var(--p)" : "1px solid #d7dde4",
              background: active ? "color-mix(in srgb, var(--p) 8%, #fff)" : "#fff",
              color: active ? "var(--p)" : "#3a4554",
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <span
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 999,
          background: "var(--p)",
          color: "#fff",
          fontFamily: "var(--head)",
          fontWeight: 800,
          fontSize: 14,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {n}
      </span>
      <h2 style={{ fontFamily: "var(--head)", fontSize: 19, fontWeight: 700, color: "#0f1b29", margin: 0 }}>
        {children}
      </h2>
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
  const [ready, setReady] = useState(false)
  const [buyerTypes, setBuyerTypes] = useState<string[]>([])
  const [payments, setPayments] = useState<string[]>([])
  const [propertyTypes, setPropertyTypes] = useState<string[]>(() => (hidePropControl ? [propChoices[0]] : []))
  const [locations, setLocations] = useState<string[]>([])
  const [priceIdx, setPriceIdx] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Read the Step-1 contact from sessionStorage. If phone/email are missing
  // (direct hit on this URL), send them back to Step 1 (home) — simplest path.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LEAD_KEY)
      const parsed: Lead = raw ? JSON.parse(raw) : {}
      if (!parsed.phone || !parsed.email) {
        router.replace("/")
        return
      }
      setLead(parsed)
      setReady(true)
    } catch {
      router.replace("/")
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
      const band = priceIdx != null ? PRICE_BANDS[priceIdx] : null
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
          asking_price_min: band?.min,
          asking_price_max: band?.max,
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

  if (!ready || !lead) {
    return (
      <div style={{ ...themeToCssVars(theme), minHeight: "100vh", background: "#f7f8fa" }}>
        <SiteFonts typeStyleId={theme.typeStyleId} />
      </div>
    )
  }

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #eef1f5",
    borderRadius: 16,
    padding: 24,
    marginTop: 20,
  }

  return (
    <div
      style={{
        ...themeToCssVars(theme),
        fontFamily: "var(--body)",
        color: "#0f1b29",
        background: "#f7f8fa",
        minHeight: "100vh",
      }}
    >
      <SiteFonts typeStyleId={theme.typeStyleId} />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 64px" }}>
        <div style={{ fontFamily: "var(--body)", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--a)" }}>
          Step 2 of 2 · Last step
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "#e6eaf0", marginTop: 10, overflow: "hidden" }}>
          <div style={{ width: "100%", height: "100%", background: "var(--p)" }} />
        </div>

        <h1 style={{ fontFamily: "var(--head)", fontSize: 30, fontWeight: 800, color: "var(--p)", margin: "24px 0 8px", letterSpacing: "-.01em" }}>
          {fname ? `${fname}, what should we send you?` : "What should we send you?"}
        </h1>
        <p style={{ fontSize: 15.5, color: "#5a6675", margin: 0, lineHeight: 1.6 }}>
          You&apos;re already on the list — this just tightens what we send so you only get deals that fit.
        </p>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 16, padding: "8px 14px", borderRadius: 999, background: "#fff", border: "1px solid #e6eaf0", fontSize: 13, color: "#5a6675" }}>
          <span>
            Sending to {maskPhone(lead.phone || "")} &amp; {maskEmail(lead.email || "")}
          </span>
          <span
            role="button"
            onClick={editContact}
            style={{ cursor: "pointer", fontWeight: 700, color: "var(--p)", textDecoration: "underline" }}
          >
            Edit
          </span>
        </div>

        {cfg.showBuyerTypes && buyerTypeOpts.length > 0 && (
          <div style={card}>
            <SectionTitle n={1}>{cfg.buyerTypeQuestion || "Your strategy"}</SectionTitle>
            <Chips options={buyerTypeOpts} selected={buyerTypes} onToggle={(k) => toggle(setBuyerTypes, k)} />
          </div>
        )}

        {!hidePropControl && (
          <div style={card}>
            <SectionTitle n={2}>What you buy</SectionTitle>
            <Chips
              options={propChoices.map((p) => ({ key: p, label: p }))}
              selected={propertyTypes}
              onToggle={(k) => toggle(setPropertyTypes, k)}
            />
          </div>
        )}

        <div style={card}>
          <SectionTitle n={3}>Where do you want deals?</SectionTitle>
          <p style={{ margin: "0 0 14px", fontSize: 14, color: "#5a6675", lineHeight: 1.6 }}>
            Search by state, county, or city — add as many as you&apos;d like. We&apos;ll only text you deals in
            the places you pick.
          </p>
          <LocationPicker value={locations} onChange={setLocations} />
        </div>

        {cfg.showPayments && paymentOpts.length > 0 && (
          <div style={card}>
            <SectionTitle n={4}>How you fund deals</SectionTitle>
            <Chips options={paymentOpts} selected={payments} onToggle={(k) => toggle(setPayments, k)} />
          </div>
        )}

        <div style={card}>
          <SectionTitle n={5}>Your price range</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {PRICE_BANDS.map((b, i) => {
              const active = priceIdx === i
              return (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setPriceIdx(active ? null : i)}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 999,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: active ? "2px solid var(--p)" : "1px solid #d7dde4",
                    background: active ? "color-mix(in srgb, var(--p) 8%, #fff)" : "#fff",
                    color: active ? "var(--p)" : "#3a4554",
                  }}
                >
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
            marginTop: 24,
            width: "100%",
            padding: "16px",
            borderRadius: 12,
            border: "none",
            background: "var(--a)",
            color: "var(--a-ink)",
            fontFamily: "var(--head)",
            fontWeight: 800,
            fontSize: 16.5,
            cursor: "pointer",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Saving…" : "Start sending me deals →"}
        </button>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <span
            role="button"
            onClick={() => submit(true)}
            style={{ fontSize: 14, color: "#8a94a2", cursor: "pointer", textDecoration: "underline" }}
          >
            Skip — just send me everything.
          </span>
        </div>
      </div>
    </div>
  )
}
