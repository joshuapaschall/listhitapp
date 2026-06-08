import React from "react"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import { SiteStyles } from "@/components/sites/site-styles"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { LeadForm } from "@/components/sites/lead-form"
import { DealsSection } from "@/components/sites/deals-section"
import { SiteFooter } from "@/components/sites/site-footer"
import { WRAP } from "@/lib/site-builder/blocks/primitives"
import type { LocationCopy } from "@/lib/site-builder/location-content"
import type { SiteTheme, SiteBusiness } from "@/lib/site-builder/types"

// The place label is the part of the H1 after " in " (e.g. "Atlanta, GA").
function placeFromH1(h1: string): string {
  const idx = h1.indexOf(" in ")
  return idx >= 0 ? h1.slice(idx + 4) : h1
}

// Programmatic, SEO-optimized location landing page for a tenant site. Buyer-
// targeted, persona-driven. Server component; renders in the owner's brand via
// theme tokens. Client islands (LeadForm, DealsSection, SiteFooter) hydrate
// inside SiteContextProvider.
export function LocationPage({
  host: _host,
  site: _site,
  theme,
  business,
  copy,
  formContext,
}: {
  host: string
  site: any
  theme: SiteTheme
  business: SiteBusiness
  copy: LocationCopy
  formContext: SiteFormContext
}) {
  const brandName = formContext.brandName
  const place = placeFromH1(copy.h1)

  return (
    <div
      className="lh-site"
      style={{
        ...themeToCssVars(theme),
        fontFamily: "var(--body)",
        color: "#0f1b29",
        background: "#fff",
        minHeight: "100vh",
      }}
    >
      <SiteStyles />
      <SiteFonts typeStyleId={theme.typeStyleId} />
      <SiteContextProvider value={formContext}>
        {/* Brand header */}
        <header style={{ borderBottom: "1px solid #eef1f5", background: "#fff" }}>
          <div className="lh-nav" style={{ ...WRAP, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
            <a href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 20, color: "var(--p)" }}>{brandName}</span>
            </a>
            {business.phone ? (
              <a href={`tel:${business.phone}`} style={{ fontSize: 14.5, fontWeight: 700, color: "var(--p)", textDecoration: "none" }}>
                {business.phone}
              </a>
            ) : null}
          </div>
        </header>

        {/* Hero */}
        <section style={{ background: "color-mix(in srgb, var(--p) 5%, #fff)", borderBottom: "1px solid #eef1f5" }}>
          <div
            className="lh-grid-2"
            style={{ ...WRAP, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(320px,400px)", gap: 44, alignItems: "center", padding: "56px 24px" }}
          >
            <div>
              <h1 style={{ fontFamily: "var(--head)", fontSize: "clamp(30px, 4.5vw, 48px)", fontWeight: 800, color: "#0f1b29", lineHeight: 1.08, letterSpacing: "-.02em", margin: 0 }}>
                {copy.h1}
              </h1>
              <p style={{ fontFamily: "var(--body)", fontSize: 17.5, lineHeight: 1.6, color: "#3a4554", marginTop: 16, maxWidth: 600 }}>
                {copy.intro}
              </p>
            </div>
            <div style={{ background: "#fff", border: "1px solid #eef1f5", borderRadius: 16, padding: 24, boxShadow: "0 20px 50px rgba(5,12,24,.10)" }}>
              <div style={{ fontFamily: "var(--head)", fontSize: 19, fontWeight: 800, color: "#0f1b29", lineHeight: 1.2 }}>
                Get {place} deals first
              </div>
              <p style={{ fontSize: 13.5, color: "#5a6675", marginTop: 6 }}>Free to join — by text and email.</p>
              <div style={{ marginTop: 16 }}>
                <LeadForm inline ctaLabel="Join the list" />
              </div>
            </div>
          </div>
        </section>

        {/* SEO prose */}
        <section style={{ background: "#fff" }}>
          <div style={{ ...WRAP, padding: "52px 24px", maxWidth: 820 }}>
            {copy.prose.map((s, i) => (
              <div key={i} style={{ marginBottom: i < copy.prose.length - 1 ? 32 : 0 }}>
                <h2 className="lh-h2" style={{ fontFamily: "var(--head)", fontSize: 24, fontWeight: 800, color: "var(--p)", margin: "0 0 12px", letterSpacing: "-.01em" }}>
                  {s.h2}
                </h2>
                <p style={{ fontFamily: "var(--body)", fontSize: 16, lineHeight: 1.75, color: "#3a4554", margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Market-filtered deals (cards link to /properties/{slug}) */}
        <DealsSection heading={`Available deals in ${place}`} />

        {/* CTA band */}
        <section style={{ background: "var(--p)" }}>
          <div style={{ ...WRAP, padding: "48px 24px", textAlign: "center" }}>
            <h2 className="lh-h2" style={{ fontFamily: "var(--head)", fontSize: 28, fontWeight: 800, color: "#fff", margin: 0 }}>
              See {place} deals before anyone else
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,.85)", marginTop: 10, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
              Join {brandName}&apos;s buyer list and get matching deals the moment they&apos;re available.
            </p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
            <a
              href="/properties"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginTop: 22,
                background: "var(--a)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15.5,
                textDecoration: "none",
                padding: "14px 28px",
                borderRadius: 10,
              }}
            >
              Browse all deals →
            </a>
          </div>
        </section>

        <SiteFooter />
      </SiteContextProvider>
    </div>
  )
}
