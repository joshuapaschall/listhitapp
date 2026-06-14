"use client"
import React from "react"
import { useSearchParams } from "next/navigation"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import type { SiteTheme } from "@/lib/site-builder/types"

const INK = "#0f1b29"
const MUT = "#5a6675"
const LINE = "#e8ebf1"
const PAGE = "#f6f7f9"

const STEPS = [
  { title: "You're already confirmed", body: "Nothing to reply to — deals start flowing by text and email right away." },
  { title: "Save our number", body: "Add us to your contacts so deal alerts never get buried." },
  { title: "Move fast", body: "The best deals are gone within 48 hours — when one fits, reach out right away." },
]

function BrandLockup({ logoUrl, brandName }: { logoUrl?: string; brandName: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={brandName} style={{ height: 30, maxHeight: 30, width: "auto", maxWidth: 170, objectFit: "contain", display: "block" }} />
  }
  return <span style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 17, color: "var(--p)" }}>{brandName}</span>
}

export function WelcomePage({ brandName, theme }: { brandName: string; theme: SiteTheme }) {
  const searchParams = useSearchParams()
  const fname = searchParams.get("fname") || ""

  return (
    <div style={{ ...themeToCssVars(theme), fontFamily: "var(--body)", color: INK, background: PAGE, minHeight: "100vh" }}>
      <SiteFonts typeStyleId={theme.typeStyleId} />

      <header style={{ background: "#fff", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "13px 20px", display: "flex", justifyContent: "center" }}>
          <BrandLockup logoUrl={theme.logoUrl} brandName={brandName} />
        </div>
      </header>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px 64px", textAlign: "center" }}>
        <div
          style={{
            width: 60,
            height: 60,
            margin: "0 auto 6px",
            borderRadius: 999,
            background: "color-mix(in srgb, var(--p) 10%, #fff)",
            color: "var(--p)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--a)", marginTop: 14 }}>
          You&apos;re all set
        </div>
        <h1 style={{ fontFamily: "var(--head)", fontSize: 30, fontWeight: 800, color: "var(--p)", margin: "7px 0 0", letterSpacing: "-.01em" }}>
          {fname ? `You're on the list, ${fname}.` : "You're on the list."}
        </h1>
        <p style={{ fontSize: 15.5, color: MUT, margin: "12px 0 0", lineHeight: 1.55 }}>
          New deals that match what you told us come straight to your phone and inbox. Here&apos;s how to get the most out of it.
        </p>

        <div style={{ position: "relative", marginTop: 30, textAlign: "left" }}>
          <div style={{ position: "absolute", left: 13, top: 8, bottom: 8, width: 2, background: "#edf0f4" }} />
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: i < STEPS.length - 1 ? 18 : 0, position: "relative" }}>
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
                  zIndex: 1,
                }}
              >
                {i + 1}
              </span>
              <div>
                <div style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 16, color: INK }}>{s.title}</div>
                <div style={{ fontSize: 14.5, color: MUT, marginTop: 3, lineHeight: 1.5 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
        <a
          href="/properties"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 30,
            padding: "14px 28px",
            borderRadius: 12,
            background: "var(--a)",
            color: "var(--a-ink)",
            fontFamily: "var(--head)",
            fontWeight: 800,
            fontSize: 16,
            textDecoration: "none",
          }}
        >
          See current deals →
        </a>
        <div style={{ fontSize: 13.5, color: MUT, marginTop: 13 }}>Or sit tight — the next deal&apos;s on its way.</div>
        <div style={{ marginTop: 22, fontSize: 12.5, color: MUT }}>{brandName}</div>
      </div>
    </div>
  )
}
