"use client"
import type React from "react"
import { useSiteForm } from "@/lib/site-builder/site-context"
import { DealCard } from "@/components/sites/deal-card"
import { WRAP, HEADING } from "@/lib/site-builder/blocks/primitives"
import { placeholderDealsFor } from "@/lib/site-builder/placeholder-deals"
import type { DealSummary } from "@/lib/site-builder/types"

const unlockBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "var(--p)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  textDecoration: "none",
  padding: "13px 26px",
  borderRadius: 10,
}

// Property grid section — reads the org's real deals from site context. A real
// component (uppercase) so the hook obeys rules-of-hooks. When there are no real
// deals yet, it renders persona-aware placeholder cards (visibly placeholders)
// so the section converts and never looks unfinished.
export function DealsSection({ heading }: { heading?: string }) {
  const { deals, persona } = useSiteForm()
  const hasReal = deals.length > 0
  const placeholders = hasReal ? [] : placeholderDealsFor(persona)
  return (
    <section style={{ background: "color-mix(in srgb, var(--p) 5%, #fff)" }}>
      <div style={{ ...WRAP, padding: "64px 24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", margin: 0 }}>{heading}</h2>
        </div>
        {hasReal ? (
          <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
            {deals.slice(0, 6).map((d) => (
              <DealCard key={d.id} property={d} variant="teaser" href={d.slug ? `/properties/${d.slug}` : "/properties"} />
            ))}
          </div>
        ) : (
          <>
            <p style={{ fontSize: 15, color: "#5a6675", lineHeight: 1.6, margin: "0 0 22px", maxWidth: 720 }}>
              New off-market deals drop here every week — join the list to unlock the address, photos, and numbers, and get the next one by text and email.
            </p>
            <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
              {placeholders.map((p, i) => (
                <DealCard key={i} property={{} as DealSummary} placeholder={p} />
              ))}
            </div>
          </>
        )}
        <div style={{ marginTop: 28, textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
          <a href="/properties" style={unlockBtn}>
            🔒 Unlock all deals →
          </a>
        </div>
      </div>
    </section>
  )
}
