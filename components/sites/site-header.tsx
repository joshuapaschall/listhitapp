import React from "react"
import { WRAP } from "@/lib/site-builder/blocks/primitives"

// Shared sub-page header — one source of truth so the property, blog-post, and
// /properties pages render the SAME complete nav as the home page (brand + links
// + phone + "Get deals" CTA), instead of a stripped brand+phone bar. On-brand via
// theme CSS vars set by the page wrapper. Uses the lh-nav/lh-nav-links classNames
// so existing responsive CSS applies. Tenant routes → plain <a>.
export function SiteHeader({
  brandName,
  logoUrl,
  phone,
  links,
  ctaHref = "/get-on-the-list",
  ctaLabel = "Get deals",
}: {
  brandName: string
  logoUrl?: string | null
  phone?: string | null
  links: { label: string; href: string }[]
  ctaHref?: string
  ctaLabel?: string
}) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, borderBottom: "1px solid #eef1f5", background: "#fff" }}>
      <div
        className="lh-nav"
        style={{ ...WRAP, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 24px" }}
      >
        {/* eslint-disable @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName} style={{ height: 30 }} />
          ) : null}
          <span style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 20, color: "var(--p)" }}>{brandName}</span>
        </a>

        <nav className="lh-nav-links" style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
          {links.map((l) => (
            <a key={l.href} href={l.href} style={{ color: "#3a4554", textDecoration: "none", fontSize: 14.5 }}>
              {l.label}
            </a>
          ))}
          {phone ? (
            <a href={`tel:${phone}`} style={{ color: "var(--p)", fontWeight: 700, textDecoration: "none", fontSize: 14.5 }}>
              {phone}
            </a>
          ) : null}
          <a
            href={ctaHref}
            style={{
              background: "var(--a)",
              color: "var(--a-ink)",
              fontWeight: 700,
              fontSize: 14.5,
              textDecoration: "none",
              padding: "9px 16px",
              borderRadius: 10,
            }}
          >
            {ctaLabel}
          </a>
        </nav>
        {/* eslint-enable @next/next/no-html-link-for-pages */}
      </div>
    </header>
  )
}
