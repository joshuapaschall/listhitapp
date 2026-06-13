import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import { SiteStyles } from "@/components/sites/site-styles"
import { SiteHeader } from "@/components/sites/site-header"
import { SiteFooter } from "@/components/sites/site-footer"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import type { SiteTheme } from "@/lib/site-builder/types"
import type { LegalDoc } from "@/lib/site-builder/compliance"

// Generated, always-in-sync legal page. Uses the shared SiteHeader + SiteFooter so
// its chrome matches every other page. On-brand via theme CSS vars; fonts loaded
// the same way as SiteRenderer.
export function LegalPage({
  doc,
  brandName,
  phone,
  theme,
  business,
  navLinks,
  formContext,
}: {
  doc: LegalDoc
  brandName: string
  phone?: string
  theme: SiteTheme
  business: any
  navLinks: { label: string; href: string }[]
  formContext: SiteFormContext
}) {
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
        <SiteHeader brandName={brandName} logoUrl={business?.logoUrl ?? null} phone={phone} links={navLinks} />

        <main style={{ flex: 1 }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
            <h1 style={{ fontFamily: "var(--head)", fontSize: 32, fontWeight: 800, color: "var(--p)", margin: 0, letterSpacing: "-.01em" }}>
              {doc.title}
            </h1>
            {doc.intro ? (
              <p style={{ marginTop: 10, fontSize: 16, color: "#42505f" }}>{doc.intro}</p>
            ) : null}

            {doc.sections.map((section, si) => (
              <section key={si} style={{ marginTop: 28 }}>
                {section.heading ? (
                  <h2 style={{ fontFamily: "var(--head)", fontSize: 20, fontWeight: 700, color: "#0f1b29", margin: "0 0 10px" }}>
                    {section.heading}
                  </h2>
                ) : null}
                {section.paragraphs.map((p, pi) => (
                  <p key={pi} style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.65, color: "#3a4554" }}>
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </main>

        <SiteFooter />
      </SiteContextProvider>
    </div>
  )
}
