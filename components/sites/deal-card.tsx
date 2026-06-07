import React from "react"
import type { DealSummary } from "@/lib/site-builder/types"

export interface DealCardProps {
  property: DealSummary
  variant?: "teaser" | "full"
  locked?: boolean
  href?: string
  statusLabel?: string
}

function formatUsd(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null
  return `$${Math.round(n).toLocaleString("en-US")}`
}

function specLine(p: DealSummary): string {
  const parts: string[] = []
  if (p.bedrooms != null) parts.push(`${p.bedrooms} bd`)
  if (p.bathrooms != null) parts.push(`${p.bathrooms} ba`)
  if (p.sqft != null) parts.push(`${p.sqft.toLocaleString("en-US")} sqft`)
  return parts.join(" · ")
}

// Presentational deal card, on-brand via theme vars (--p/--a/--head). "teaser"
// hides the street address; "full" shows it. `locked` overlays a join-to-unlock
// treatment and NEVER renders the address, regardless of variant. When `href` is
// provided and the card is not locked, the whole card becomes a link.
export function DealCard({ property, variant = "teaser", locked = false, href, statusLabel }: DealCardProps) {
  const price = formatUsd(property.price)
  const cityState = [property.city, property.state].filter(Boolean).join(", ")
  const specs = specLine(property)
  const showAddress = !locked && variant === "full" && !!property.address
  const gradient =
    "linear-gradient(135deg, color-mix(in srgb, var(--p) 22%, #fff), color-mix(in srgb, var(--a) 22%, #fff))"

  const card = (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eef1f5",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(16,27,41,.05)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ position: "relative", height: 150, background: gradient }}>
        {property.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={property.primary_image_url}
            alt={cityState || property.slug}
            width={400}
            height={150}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : null}
        {!locked ? (
          <span
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 700,
              background: "var(--a)",
              color: "#fff",
            }}
          >
            {statusLabel || "For Sale"}
          </span>
        ) : null}
        {property.property_type ? (
          <span
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 700,
              background: "rgba(255,255,255,.92)",
              color: "var(--p)",
            }}
          >
            {property.property_type}
          </span>
        ) : null}
        {locked ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(180deg, rgba(11,18,28,.18), rgba(11,18,28,.55))",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(15,27,41,.88)",
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              🔒 Join to unlock
            </span>
          </div>
        ) : null}
      </div>

      <div style={{ padding: 16 }}>
        {price ? (
          <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 22, color: "var(--p)", lineHeight: 1.1 }}>
            {price}
          </div>
        ) : null}
        {showAddress ? (
          <div style={{ marginTop: 6, fontSize: 14.5, fontWeight: 600, color: "#0f1b29" }}>{property.address}</div>
        ) : null}
        {cityState ? (
          <div style={{ marginTop: showAddress ? 2 : 6, fontSize: 14, color: "#42505f" }}>{cityState}</div>
        ) : null}
        {locked ? (
          <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--a)" }}>
            🔒 Address &amp; full details after you join
          </div>
        ) : specs ? (
          <div style={{ marginTop: 8, fontSize: 13, color: "#8a94a2" }}>{specs}</div>
        ) : null}
      </div>
    </div>
  )

  if (href && !locked) {
    return (
      // eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route
      <a href={href} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
        {card}
      </a>
    )
  }
  return card
}
