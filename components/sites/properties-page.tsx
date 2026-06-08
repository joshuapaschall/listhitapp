import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import type { SiteTheme, SiteBusiness, DealSummary } from "@/lib/site-builder/types"
import type { SiteFormContext } from "@/lib/site-builder/site-context"
import { DealCard } from "@/components/sites/deal-card"
import { PropertiesGate } from "./properties-gate"

// On-brand shell for the gated /properties page (mirrors legal-page.tsx). Server
// component — receives all data as props and imports nothing server-only.
export function PropertiesPage({
  brandName,
  theme,
  business,
  formContext,
  unlocked,
  deals,
  count,
  publicMode,
}: {
  brandName: string
  theme: SiteTheme
  business: SiteBusiness
  formContext: SiteFormContext
  unlocked: boolean
  deals: DealSummary[]
  count: number
  publicMode?: boolean
}) {
  // Public sites and cookie-unlocked sites both show full cards; only public
  // sites link each card to its (indexable) detail page — detail pages 404 when
  // deals_public is off, so the unlocked-but-gated funnel must not link out.
  const showFull = publicMode || unlocked
  const footerLinks = [
    { label: "Home", href: "/" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Use", href: "/terms" },
  ]

  return (
    <div
      style={{
        ...themeToCssVars(theme),
        fontFamily: "var(--body)",
        color: "#0f1b29",
        background: "#fff",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SiteFonts typeStyleId={theme.typeStyleId} />

      <header style={{ borderBottom: "1px solid #eef1f5", background: "#fff" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "16px 24px" }}>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
          <a href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 20, color: "var(--p)" }}>
              {brandName}
            </span>
          </a>
        </div>
      </header>

      <main style={{ flex: 1, background: "color-mix(in srgb, var(--p) 5%, #fff)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 24px" }}>
          {showFull ? (
            <>
              <h1 style={{ fontFamily: "var(--head)", fontSize: 32, fontWeight: 800, color: "var(--p)", margin: "0 0 28px", letterSpacing: "-.01em" }}>
                {count} available {count === 1 ? "deal" : "deals"}
              </h1>
              {deals.length > 0 ? (
                <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
                  {deals.map((d) => (
                    <DealCard
                      key={d.id}
                      property={d}
                      variant="full"
                      href={publicMode && d.slug ? `/properties/${d.slug}` : undefined}
                    />
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 15, color: "#5a6675" }}>No deals available right now — check back soon.</p>
              )}
            </>
          ) : (
            <PropertiesGate brandName={brandName} count={count} deals={deals} formContext={formContext} />
          )}
        </div>
      </main>

      <footer style={{ borderTop: "1px solid #eef1f5", background: "#fff" }}>
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: "#8a94a2" }}>© {brandName}. All rights reserved.</span>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            {footerLinks.map((l) => (
              // eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route
              <a key={l.href} href={l.href} style={{ fontSize: 13, color: "#5a6675", textDecoration: "none" }}>
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
