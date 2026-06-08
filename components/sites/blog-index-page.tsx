import React from "react"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { siteImage, siteSrcSet } from "@/lib/site-builder/image-url"
import { SiteFonts } from "@/components/sites/site-fonts"
import { SiteStyles } from "@/components/sites/site-styles"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { SiteFooter } from "@/components/sites/site-footer"
import { WRAP } from "@/lib/site-builder/blocks/primitives"
import type { SiteTheme, SiteBusiness, PostSummary } from "@/lib/site-builder/types"

function formatDate(iso: string | null): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return ""
  }
}

// Public, brand-rendered blog index for a tenant site. Mirrors PropertyPage's
// shell (lh-site container, theme tokens, header/footer, SiteContextProvider).
export function BlogIndexPage({
  host: _host,
  site: _site,
  theme,
  business,
  formContext,
  posts,
}: {
  host: string
  site: any
  theme: SiteTheme
  business: SiteBusiness
  formContext: SiteFormContext
  posts: PostSummary[]
}) {
  const brandName = formContext.brandName

  return (
    <div
      className="lh-site"
      style={{
        ...themeToCssVars(theme),
        fontFamily: "var(--body)",
        color: "#0f1b29",
        background: "#fff",
        minHeight: "100vh",
      }}
    >
      <SiteStyles />
      <SiteFonts typeStyleId={theme.typeStyleId} />
      <SiteContextProvider value={formContext}>
        {/* Brand header */}
        <header style={{ borderBottom: "1px solid #eef1f5", background: "#fff" }}>
          <div className="lh-nav" style={{ ...WRAP, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
            <a href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 20, color: "var(--p)" }}>{brandName}</span>
            </a>
            {business.phone ? (
              <a href={`tel:${business.phone}`} style={{ fontSize: 14.5, fontWeight: 700, color: "var(--p)", textDecoration: "none" }}>
                {business.phone}
              </a>
            ) : null}
          </div>
        </header>

        <main style={{ background: "color-mix(in srgb, var(--p) 4%, #fff)" }}>
          <div style={{ ...WRAP, padding: "40px 24px 64px" }}>
            <h1 style={{ fontFamily: "var(--head)", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, color: "var(--p)", margin: "0 0 28px", letterSpacing: "-.01em" }}>
              Blog
            </h1>

            {posts.length === 0 ? (
              <div style={{ borderRadius: 16, border: "1px dashed #d7dde4", background: "#fff", padding: "56px 24px", textAlign: "center", color: "#5a6675" }}>
                No posts yet — check back soon.
              </div>
            ) : (
              <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
                {posts.map((p) => (
                  // eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route
                  <a
                    key={p.id}
                    href={`/blog/${p.slug}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
                  >
                    <div style={{ background: "#fff", border: "1px solid #eef1f5", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 24px rgba(16,27,41,.05)", display: "flex", flexDirection: "column", height: "100%" }}>
                      <div style={{ height: 160, background: "color-mix(in srgb, var(--p) 8%, #fff)" }}>
                        {p.featuredImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={siteImage(p.featuredImageUrl, { width: 800 })}
                            srcSet={siteSrcSet(p.featuredImageUrl, [400, 800])}
                            sizes="(max-width: 768px) 100vw, 360px"
                            alt={p.featuredImageAlt || p.title}
                            width={400}
                            height={160}
                            loading="lazy"
                            decoding="async"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : null}
                      </div>
                      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontFamily: "var(--head)", fontSize: 18, fontWeight: 700, color: "#0f1b29", lineHeight: 1.25 }}>
                          {p.title}
                        </div>
                        {p.excerpt ? (
                          <p style={{ fontSize: 14, lineHeight: 1.55, color: "#5a6675", margin: 0 }}>{p.excerpt}</p>
                        ) : null}
                        {p.publishedAt ? (
                          <div style={{ fontSize: 12.5, color: "#8a94a2", marginTop: 2 }}>{formatDate(p.publishedAt)}</div>
                        ) : null}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </main>

        <SiteFooter />
      </SiteContextProvider>
    </div>
  )
}
