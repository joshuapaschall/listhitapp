import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import type { SiteTheme } from "@/lib/site-builder/types"
import type { LegalDoc } from "@/lib/site-builder/compliance"

// Generated, always-in-sync legal/contact page. Server component, minimal JS.
// On-brand via theme CSS vars; fonts loaded the same way as SiteRenderer.
export function LegalPage({
  doc,
  brandName,
  phone,
  theme,
}: {
  doc: LegalDoc
  brandName: string
  phone?: string
  theme: SiteTheme
}) {
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
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
          <a href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 20, color: "var(--p)" }}>
              {brandName}
            </span>
          </a>
          {phone ? (
            <a href={`tel:${phone}`} style={{ color: "var(--p)", fontWeight: 700, textDecoration: "none", fontSize: 14.5 }}>
              {phone}
            </a>
          ) : null}
        </div>
      </header>

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
          <span style={{ fontSize: 13, color: "#8a94a2" }}>
            © {brandName}. All rights reserved.
          </span>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            {footerLinks.map((l) => (
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
