"use client"

import React, { useState } from "react"
import { WRAP } from "@/lib/site-builder/blocks/primitives"
import { siteImage } from "@/lib/site-builder/image-url"

// THE single header for every published page (home/Puck pages via the Nav block,
// and every reserved page directly). Brand + canonical links + phone + "Get deals"
// CTA on desktop; a hamburger drawer on narrow containers. On-brand via theme CSS
// vars set by the page wrapper. Tenant routes → plain <a>.
export function SiteHeader({
  brandName,
  logoUrl,
  phone,
  links,
  ctaHref = "/get-on-the-list",
  ctaLabel = "Get deals",
  layout = "split",
}: {
  brandName: string
  logoUrl?: string | null
  phone?: string | null
  links: { label: string; href: string }[]
  ctaHref?: string
  ctaLabel?: string
  layout?: "split" | "center"
}) {
  const [open, setOpen] = useState(false)
  const center = layout === "center"

  const ctaStyle: React.CSSProperties = {
    background: "var(--a)",
    color: "var(--a-ink)",
    fontWeight: 700,
    fontSize: 14.5,
    textDecoration: "none",
    padding: "9px 16px",
    borderRadius: 10,
  }

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, borderBottom: "1px solid #eef1f5", background: "#fff" }}>
      <div
        className="lh-nav"
        style={{
          ...WRAP,
          display: "flex",
          alignItems: "center",
          justifyContent: center ? "center" : "space-between",
          textAlign: center ? "center" : "left",
          gap: 12,
          padding: "16px 24px",
        }}
      >
        {/* eslint-disable @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={siteImage(logoUrl, { width: 400, quality: 90 })}
              alt={brandName}
              style={{ height: 34, maxHeight: 34, width: "auto", maxWidth: 190, objectFit: "contain", display: "block" }}
            />
          ) : (
            <span style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 20, color: "var(--p)" }}>{brandName}</span>
          )}
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
          <a href={ctaHref} style={ctaStyle}>
            {ctaLabel}
          </a>
        </nav>

        {/* Hamburger — hidden on desktop, shown on narrow containers (see site-styles). */}
        <button
          type="button"
          className="lh-nav-burger"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="lh-mobile-drawer"
          onClick={() => setOpen(true)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--p)" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Mobile drawer — always rendered for stable SSR; visibility is CSS-driven off data-open. */}
        <div id="lh-mobile-drawer" className="lh-nav-drawer" data-open={open}>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 14px 0" }}>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, display: "inline-flex" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--p)" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
          <div style={{ paddingBottom: 14 }}>
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{ display: "block", padding: "11px 18px", fontSize: 15, color: "#27323f", textDecoration: "none" }}
              >
                {l.label}
              </a>
            ))}
            <div style={{ borderTop: "1px solid #eef1f5", margin: "8px 0" }} />
            {phone ? (
              <a
                href={`tel:${phone}`}
                onClick={() => setOpen(false)}
                style={{ display: "block", padding: "11px 18px", fontSize: 15, fontWeight: 700, color: "var(--p)", textDecoration: "none" }}
              >
                {phone}
              </a>
            ) : null}
            <div style={{ padding: "8px 18px 0" }}>
              <a href={ctaHref} onClick={() => setOpen(false)} style={{ ...ctaStyle, display: "block", textAlign: "center" }}>
                {ctaLabel}
              </a>
            </div>
          </div>
        </div>
        {/* eslint-enable @next/next/no-html-link-for-pages */}
      </div>
    </header>
  )
}
