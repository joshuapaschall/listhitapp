import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import { SiteStyles } from "@/components/sites/site-styles"
import { SiteHeader } from "@/components/sites/site-header"
import { SiteFooter } from "@/components/sites/site-footer"
import type { SiteTheme, SiteBusiness, DealSummary } from "@/lib/site-builder/types"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { DealCard } from "@/components/sites/deal-card"
import { PropertiesGate } from "./properties-gate"
import { PropertiesFilterBar } from "@/components/sites/properties-filter-bar"

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
  filters,
  navLinks = [],
}: {
  brandName: string
  theme: SiteTheme
  business: SiteBusiness
  formContext: SiteFormContext
  unlocked: boolean
  deals: DealSummary[]
  count: number
  publicMode?: boolean
  filters?: { sort: string; beds: string; baths: string; terms: string }
  navLinks?: { label: string; href: string }[]
}) {
  // Public sites and cookie-unlocked sites both show full cards; only public
  // sites link each card to its (indexable) detail page — detail pages 404 when
  // deals_public is off, so the unlocked-but-gated funnel must not link out.
  const showFull = publicMode || unlocked
  const filtersActive = !!filters && (filters.beds !== "0" || filters.baths !== "0" || filters.terms !== "any")

  return (
    <div
      className="lh-site"
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
      <SiteStyles />
      <SiteFonts typeStyleId={theme.typeStyleId} />
      <SiteContextProvider value={formContext}>
      <SiteHeader brandName={brandName} phone={business.phone} links={navLinks} />

      <main style={{ flex: 1, background: "color-mix(in srgb, var(--p) 5%, #fff)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 24px" }}>
          {showFull ? (
            <>
              {filters ? <PropertiesFilterBar basePath="/properties" initial={filters} /> : null}
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
                <p style={{ fontSize: 15, color: "#5a6675" }}>
                  {filtersActive
                    ? "No deals match these filters — try widening your search."
                    : "No deals available right now — check back soon."}
                </p>
              )}
            </>
          ) : (
            <PropertiesGate brandName={brandName} count={count} deals={deals} formContext={formContext} />
          )}
        </div>
      </main>

      <SiteFooter />
      </SiteContextProvider>
    </div>
  )
}
