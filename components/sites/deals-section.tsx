"use client"
import { useSiteForm } from "@/lib/site-builder/site-context"
import { DealCard } from "@/components/sites/deal-card"
import { WRAP, HEADING } from "@/lib/site-builder/blocks/primitives"

// Property grid section — reads the org's real deals from site context. A real
// component (uppercase) so the hook obeys rules-of-hooks.
export function DealsSection({ heading }: { heading?: string }) {
  const { deals } = useSiteForm()
  return (
    <section style={{ background: "color-mix(in srgb, var(--p) 5%, #fff)" }}>
      <div style={{ ...WRAP, padding: "64px 24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", margin: 0 }}>{heading}</h2>
        </div>
        {deals.length > 0 ? (
          <>
            <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
              {deals.slice(0, 6).map((d) => (
                <DealCard key={d.id} property={d} variant="teaser" href={d.slug ? `/properties/${d.slug}` : "/properties"} />
              ))}
            </div>
            <div style={{ marginTop: 28, textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
              <a
                href="/properties"
                style={{
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
                }}
              >
                🔒 Unlock all deals →
              </a>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14.5, color: "#8a94a2", padding: "8px 0" }}>
            Your published deals will appear here.
          </div>
        )}
      </div>
    </section>
  )
}
