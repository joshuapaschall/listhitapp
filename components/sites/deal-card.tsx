import React from "react"
import type { DealSummary } from "@/lib/site-builder/types"

export interface DealCardProps {
  property: DealSummary
  variant?: "teaser" | "full"
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

// Presentational deal card, on-brand via the page's theme CSS vars (--p/--a/
// --head). "teaser" hides the street address; "full" shows it above the city.
export function DealCard({ property, variant = "teaser" }: DealCardProps) {
  const price = formatUsd(property.price)
  const cityState = [property.city, property.state].filter(Boolean).join(", ")
  const specs = specLine(property)
  const gradient =
    "linear-gradient(135deg, color-mix(in srgb, var(--p) 22%, #fff), color-mix(in srgb, var(--a) 22%, #fff))"

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eef1f5",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(16,27,41,.05)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ position: "relative", height: 150, background: gradient }}>
        {property.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={property.primary_image_url}
            alt={cityState || property.slug}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : null}
        {property.property_type ? (
          <span
            style={{
              position: "absolute",
              left: 12,
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
      </div>

      <div style={{ padding: 16 }}>
        {price ? (
          <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 22, color: "var(--p)", lineHeight: 1.1 }}>
            {price}
          </div>
        ) : null}
        {variant === "full" && property.address ? (
          <div style={{ marginTop: 6, fontSize: 14.5, fontWeight: 600, color: "#0f1b29" }}>{property.address}</div>
        ) : null}
        {cityState ? (
          <div style={{ marginTop: variant === "full" && property.address ? 2 : 6, fontSize: 14, color: "#42505f" }}>
            {cityState}
          </div>
        ) : null}
        {specs ? <div style={{ marginTop: 8, fontSize: 13, color: "#8a94a2" }}>{specs}</div> : null}
      </div>
    </div>
  )
}
