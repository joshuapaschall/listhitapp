import React from "react"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import { SiteHeader } from "@/components/sites/site-header"
import { SiteStyles } from "@/components/sites/site-styles"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { LeadForm } from "@/components/sites/lead-form"
import { SiteFooter } from "@/components/sites/site-footer"
import { DealCard } from "@/components/sites/deal-card"
import { PropertyGallery } from "@/components/sites/property-gallery"
import { WRAP } from "@/lib/site-builder/blocks/primitives"
import type { SiteTheme, SiteBusiness, DealDetail, DealSummary, SitePersona } from "@/lib/site-builder/types"

const FINANCE_SUBTYPE_LABEL: Record<string, string> = {
  owner_finance: "Owner finance",
  subject_to: "Subject-to",
  land_contract: "Land contract",
}

// Friendly, buyer-facing terms label derived from deal_type/finance_subtype.
function termsLabel(deal: DealDetail): string {
  if (deal.deal_type === "creative") {
    return (deal.finance_subtype && FINANCE_SUBTYPE_LABEL[deal.finance_subtype]) || "Creative finance"
  }
  return "All cash"
}

const PERSONA_CTA: Record<SitePersona, string> = {
  cash: "Cash buyers get first access — join free below.",
  investor: "Investors: get vetted deals like this in your inbox.",
  rto: "Rent-to-own ready? Get full details and terms below.",
  owner: "Owner-finance buyers: unlock the numbers and terms.",
  creative: "Creative-terms buyers: see the full deal structure.",
  land: "Land buyers: get the parcel details and join the list.",
  commercial: "Commercial buyers: request the full deal package.",
  agent: "Get full details on this property — join the list.",
}

function usd(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null
  return `$${Math.round(n).toLocaleString("en-US")}`
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "#5a6675" }}>
        {label}
      </div>
      <div style={{ marginTop: 3, fontSize: 15, fontWeight: 600, color: "#0f1b29" }}>{value}</div>
    </div>
  )
}

// Public, SEO-indexable individual property page for a tenant site. Buyer-
// targeted (the visitor is a buyer/investor). Server component; renders in the
// owner's brand via theme tokens. Client islands (gallery, LeadForm, footer)
// hydrate inside SiteContextProvider.
export function PropertyPage({
  host: _host,
  site: _site,
  theme,
  business,
  deal,
  nearby,
  formContext,
  cityLocationHref,
  navLinks = [],
}: {
  host: string
  site: any
  theme: SiteTheme
  business: SiteBusiness
  deal: DealDetail
  nearby: DealSummary[]
  formContext: SiteFormContext
  cityLocationHref: string | null
  navLinks?: { label: string; href: string }[]
}) {
  const brandName = formContext.brandName
  const price = usd(deal.price)
  const cityState = [deal.city, deal.state].filter(Boolean).join(", ")
  const terms = termsLabel(deal)
  const cityHref = cityLocationHref || "/properties"
  const specBits = [
    deal.bedrooms != null ? `${deal.bedrooms} bd` : null,
    deal.bathrooms != null ? `${deal.bathrooms} ba` : null,
    deal.sqft != null ? `${deal.sqft.toLocaleString("en-US")} sqft` : null,
    deal.property_type || null,
  ].filter(Boolean)
  const descParas = (deal.description || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  const badge = (label: string, kind: "accent" | "primary") => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 12px",
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 700,
        background: kind === "accent" ? "var(--a)" : "color-mix(in srgb, var(--p) 10%, #fff)",
        color: kind === "accent" ? "#fff" : "var(--p)",
      }}
    >
      {label}
    </span>
  )

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
        <SiteHeader brandName={brandName} phone={business.phone} links={navLinks} />

        <main style={{ background: "color-mix(in srgb, var(--p) 4%, #fff)" }}>
          <div style={{ ...WRAP, padding: "24px 24px 56px" }}>
            {/* Breadcrumbs */}
            <nav style={{ fontFamily: "var(--body)", fontSize: 13, color: "#5a6675", marginBottom: 20 }}>
              {/* eslint-disable @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
              <a href="/" style={{ color: "#5a6675", textDecoration: "none" }}>Home</a>
              <span style={{ margin: "0 8px" }}>/</span>
              <a href={cityHref} style={{ color: "#5a6675", textDecoration: "none" }}>{cityState || "Deals"}</a>
              {/* eslint-enable @next/next/no-html-link-for-pages */}
              {deal.address ? (
                <>
                  <span style={{ margin: "0 8px" }}>/</span>
                  <span style={{ color: "#0f1b29" }}>{deal.address}</span>
                </>
              ) : null}
            </nav>

            <div className="lh-grid-2" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(320px,380px)", gap: 40, alignItems: "start" }}>
              {/* Main column */}
              <div>
                <PropertyGallery images={deal.images} alt={deal.address || cityState || brandName} />

                {deal.photo_album_url ? (
                  <a
                    href={deal.photo_album_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-block", marginTop: 12, fontSize: 13.5, fontWeight: 700, color: "var(--a)", textDecoration: "none" }}
                  >
                    View all photos →
                  </a>
                ) : null}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
                  {badge("Available", "primary")}
                  {badge(terms, "accent")}
                </div>

                <h1 style={{ fontFamily: "var(--head)", fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800, color: "#0f1b29", lineHeight: 1.1, letterSpacing: "-.01em", margin: "12px 0 0" }}>
                  {deal.address || cityState || "Off-market property"}
                </h1>
                {cityState ? (
                  <div style={{ marginTop: 6, fontSize: 16, color: "#42505f" }}>{cityState}{deal.zip ? ` ${deal.zip}` : ""}</div>
                ) : null}

                {price ? (
                  <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 34, color: "var(--p)", marginTop: 16, lineHeight: 1 }}>
                    {price}
                  </div>
                ) : null}
                {specBits.length > 0 ? (
                  <div style={{ marginTop: 10, fontSize: 15, color: "#5a6675" }}>{specBits.join("  ·  ")}</div>
                ) : null}

                {/* Key facts */}
                <div
                  style={{
                    marginTop: 24,
                    padding: 20,
                    borderRadius: 14,
                    border: "1px solid #eef1f5",
                    background: "#fff",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: 18,
                  }}
                >
                  {price ? <Fact label="Price" value={price} /> : null}
                  {deal.bedrooms != null ? <Fact label="Beds" value={deal.bedrooms} /> : null}
                  {deal.bathrooms != null ? <Fact label="Baths" value={deal.bathrooms} /> : null}
                  {deal.sqft != null ? <Fact label="Sqft" value={deal.sqft.toLocaleString("en-US")} /> : null}
                  {deal.property_type ? <Fact label="Property type" value={deal.property_type} /> : null}
                  <Fact label="Terms" value={terms} />
                  {cityState ? <Fact label="Location" value={cityState} /> : null}
                  {deal.zip ? <Fact label="Zip" value={deal.zip} /> : null}
                  {deal.year_built != null ? <Fact label="Year built" value={deal.year_built} /> : null}
                  {deal.lot_size ? <Fact label="Lot size" value={deal.lot_size} /> : null}
                  {deal.mls_number ? <Fact label="MLS #" value={deal.mls_number} /> : null}
                  {deal.construction_type ? <Fact label="Construction" value={deal.construction_type} /> : null}
                </div>

                {/* Description */}
                {descParas.length > 0 ? (
                  <div style={{ marginTop: 28 }}>
                    <h2 className="lh-h2" style={{ fontFamily: "var(--head)", fontSize: 22, fontWeight: 800, color: "var(--p)", margin: "0 0 12px" }}>
                      About this deal
                    </h2>
                    {descParas.map((p, i) => (
                      <p key={i} style={{ fontSize: 15.5, lineHeight: 1.7, color: "#3a4554", margin: "0 0 14px" }}>{p}</p>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Sticky sidebar (desktop) / stacked (mobile) */}
              <aside style={{ position: "sticky", top: 24 }}>
                <div style={{ background: "#fff", border: "1px solid #eef1f5", borderRadius: 16, padding: 24, boxShadow: "0 20px 50px rgba(5,12,24,.10)" }}>
                  <div style={{ fontFamily: "var(--head)", fontSize: 20, fontWeight: 800, color: "#0f1b29", lineHeight: 1.15 }}>
                    Get full details on this property
                  </div>
                  <p style={{ fontSize: 14, color: "#5a6675", marginTop: 8, lineHeight: 1.5 }}>
                    {PERSONA_CTA[formContext.persona] || PERSONA_CTA.cash}
                  </p>
                  <div style={{ marginTop: 16 }}>
                    <LeadForm inline ctaLabel="Get full details" />
                  </div>
                </div>
                {business.phone ? (
                  <a
                    href={`tel:${business.phone}`}
                    style={{
                      display: "block",
                      textAlign: "center",
                      marginTop: 14,
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: "1px solid color-mix(in srgb, var(--p) 25%, #fff)",
                      color: "var(--p)",
                      fontWeight: 700,
                      fontSize: 14.5,
                      textDecoration: "none",
                    }}
                  >
                    Call or text {business.phone}
                  </a>
                ) : null}
              </aside>
            </div>

            {/* More deals in city */}
            {nearby.length > 0 ? (
              <div style={{ marginTop: 56 }}>
                <h2 className="lh-h2" style={{ fontFamily: "var(--head)", fontSize: 26, fontWeight: 800, color: "var(--p)", margin: "0 0 20px" }}>
                  More deals{deal.city ? ` in ${deal.city}` : ""}
                </h2>
                <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
                  {nearby.map((d) => (
                    <DealCard key={d.id} property={d} variant="full" href={`/properties/${d.slug}`} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </main>

        <SiteFooter />
      </SiteContextProvider>
    </div>
  )
}
