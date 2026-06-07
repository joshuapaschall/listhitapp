"use client"

import { useState } from "react"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { LeadForm } from "@/components/sites/lead-form"
import { DealCard } from "@/components/sites/deal-card"
import type { DealSummary } from "@/lib/site-builder/types"

// Client island for the locked /properties state. Receives ALL data as props —
// it must never import server-only data modules or the service-role client
// (the outage guard): everything it needs arrives via props.
export function PropertiesGate({
  brandName,
  count,
  deals,
  formContext,
}: {
  brandName: string
  count: number
  deals: DealSummary[]
  formContext: SiteFormContext
}) {
  const [unlocking, setUnlocking] = useState(false)

  function handleComplete() {
    document.cookie = "lh_deals_unlocked=1; path=/; max-age=2592000; samesite=lax"
    setUnlocking(true)
    setTimeout(() => window.location.reload(), 900)
  }

  const headline =
    count > 0
      ? `${count} off-market ${count === 1 ? "deal" : "deals"} available right now`
      : "New deals drop here first"

  return (
    <SiteContextProvider value={formContext}>
      <div className="lh-grid-2" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(300px,400px)", gap: 40, alignItems: "start" }}>
        <div>
          <h1 style={{ fontFamily: "var(--head)", fontSize: 34, fontWeight: 800, color: "var(--p)", margin: 0, lineHeight: 1.05, letterSpacing: "-.01em" }}>
            {headline}
          </h1>
          <p style={{ fontSize: 17, color: "#42505f", marginTop: 14, maxWidth: 560, lineHeight: 1.5 }}>
            Join the buyers list to unlock full addresses, photos, numbers, and terms — instantly and free.
          </p>

          {/* Real deals, locked — proof + desire. Address is stripped upstream
              (server route) so it never reaches the client until they join. */}
          {deals.length > 0 ? (
            <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16, marginTop: 28 }}>
              {deals.map((d) => (
                <DealCard key={d.id} property={d} variant="teaser" locked />
              ))}
            </div>
          ) : (
            <div style={{ position: "relative", marginTop: 28 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16, filter: "blur(5px)", opacity: 0.6, pointerEvents: "none", userSelect: "none" }} aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #eef1f5", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 24px rgba(16,27,41,.05)" }}>
                    <div style={{ height: 120, background: "linear-gradient(135deg, color-mix(in srgb, var(--p) 22%, #fff), color-mix(in srgb, var(--a) 22%, #fff))" }} />
                    <div style={{ padding: 14 }}>
                      <div style={{ height: 18, width: "60%", borderRadius: 6, background: "#e7ebf0" }} />
                      <div style={{ height: 12, width: "80%", borderRadius: 6, background: "#eef1f5", marginTop: 10 }} />
                      <div style={{ height: 12, width: "45%", borderRadius: 6, background: "#eef1f5", marginTop: 8 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: "rgba(15,27,41,.85)", color: "#fff", fontSize: 13.5, fontWeight: 700 }}>
                  🔒 Locked — join to view
                </span>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <LeadForm
            title="Unlock the deals"
            subtitle="Join the buyers list — free"
            ctaLabel="Unlock deals"
            onComplete={handleComplete}
          />
          {unlocking && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 16,
                background: "rgba(255,255,255,.85)",
                fontFamily: "var(--head)",
                fontWeight: 700,
                color: "var(--p)",
              }}
            >
              Unlocking your deals…
            </div>
          )}
        </div>
      </div>
    </SiteContextProvider>
  )
}
