"use client"
import React from "react"
import { useSearchParams } from "next/navigation"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import type { SiteTheme } from "@/lib/site-builder/types"

const STEPS = [
  { title: "Check your texts", body: "We just sent a confirmation — reply YES so deals land instantly." },
  { title: "Add us to your contacts", body: "Save the number so our deal alerts never get buried." },
  { title: "Move fast", body: "The best deals get claimed within 48 hours — reply the moment one fits." },
]

export function WelcomePage({ brandName, theme }: { brandName: string; theme: SiteTheme }) {
  const searchParams = useSearchParams()
  const fname = searchParams.get("fname") || ""

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
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 20px",
            borderRadius: 999,
            background: "color-mix(in srgb, var(--p) 12%, #fff)",
            color: "var(--p)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 800,
          }}
        >
          ✓
        </div>
        <h1 style={{ fontFamily: "var(--head)", fontSize: 32, fontWeight: 800, color: "var(--p)", margin: 0, letterSpacing: "-.01em" }}>
          {fname ? `You're on the list, ${fname}.` : "You're on the list."}
        </h1>
        <p style={{ fontSize: 16, color: "#5a6675", margin: "12px 0 0", lineHeight: 1.6 }}>
          We&apos;ll text you new deals that match what you told us. Here&apos;s how to get the most out of it.
        </p>

        <div style={{ display: "grid", gap: 12, marginTop: 32, textAlign: "left" }}>
          {STEPS.map((s, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: 14, background: "#fff", border: "1px solid #eef1f5", borderRadius: 14, padding: 18 }}
            >
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
                {i + 1}
              </span>
              <div>
                <div style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 16, color: "#0f1b29" }}>{s.title}</div>
                <div style={{ fontSize: 14.5, color: "#5a6675", marginTop: 4, lineHeight: 1.55 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
        <a
          href="/properties"
          style={{
            display: "inline-block",
            marginTop: 32,
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
        <div style={{ marginTop: 24, fontSize: 13, color: "#8a94a2" }}>{brandName}</div>
      </div>
    </div>
  )
}
