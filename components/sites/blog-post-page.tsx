import React from "react"
import { sanitizePostHtml } from "@/lib/blog/sanitize"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { siteImage, siteSrcSet } from "@/lib/site-builder/image-url"
import { SiteFonts } from "@/components/sites/site-fonts"
import { SiteHeader } from "@/components/sites/site-header"
import { SiteStyles } from "@/components/sites/site-styles"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { LeadForm } from "@/components/sites/lead-form"
import { SiteFooter } from "@/components/sites/site-footer"
import { WRAP } from "@/lib/site-builder/blocks/primitives"
import type { SiteTheme, SiteBusiness, PostDetail } from "@/lib/site-builder/types"

function formatDate(iso: string | null): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  } catch {
    return ""
  }
}

// Public, brand-rendered blog post for a tenant site. Mirrors PropertyPage's
// shell. bodyHtml is sanitized on save and re-sanitized here (defense in depth).
export function BlogPostPage({
  host: _host,
  site: _site,
  theme,
  business,
  formContext,
  post,
  navLinks = [],
}: {
  host: string
  site: any
  theme: SiteTheme
  business: SiteBusiness
  formContext: SiteFormContext
  post: PostDetail
  navLinks?: { label: string; href: string }[]
}) {
  const brandName = formContext.brandName
  const dateLine = formatDate(post.publishedAt)
  const author = post.authorName || brandName

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
        <SiteHeader brandName={brandName} phone={business.phone} links={navLinks} />

        <main style={{ background: "color-mix(in srgb, var(--p) 4%, #fff)" }}>
          <div style={{ ...WRAP, maxWidth: 820, padding: "24px 24px 56px" }}>
            {/* Breadcrumb */}
            <nav style={{ fontFamily: "var(--body)", fontSize: 13, color: "#8a94a2", marginBottom: 20 }}>
              {/* eslint-disable @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route */}
              <a href="/" style={{ color: "#5a6675", textDecoration: "none" }}>Home</a>
              <span style={{ margin: "0 8px" }}>/</span>
              <a href="/blog" style={{ color: "#5a6675", textDecoration: "none" }}>Blog</a>
              {/* eslint-enable @next/next/no-html-link-for-pages */}
              <span style={{ margin: "0 8px" }}>/</span>
              <span style={{ color: "#0f1b29" }}>{post.title}</span>
            </nav>

            <h1 style={{ fontFamily: "var(--head)", fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 800, color: "#0f1b29", lineHeight: 1.1, letterSpacing: "-.02em", margin: 0 }}>
              {post.title}
            </h1>
            <div style={{ marginTop: 10, fontSize: 14, color: "#5a6675" }}>
              {author}
              {author && dateLine ? " · " : ""}
              {dateLine}
            </div>

            {post.featuredImageUrl ? (
              <div style={{ marginTop: 22, borderRadius: 16, overflow: "hidden", border: "1px solid #eef1f5", background: "color-mix(in srgb, var(--p) 5%, #fff)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={siteImage(post.featuredImageUrl, { width: 1200, quality: 80 })}
                  srcSet={siteSrcSet(post.featuredImageUrl, [600, 1200], 80)}
                  sizes="(max-width: 800px) 100vw, 760px"
                  alt={post.featuredImageAlt || post.title}
                  width={1200}
                  height={630}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  style={{ width: "100%", height: "auto", aspectRatio: "1200 / 630", objectFit: "cover", display: "block" }}
                />
              </div>
            ) : null}

            {/* Post body (sanitized on save) */}
            <article
              className="lh-prose"
              style={{ marginTop: 28, fontSize: 16.5, lineHeight: 1.75, color: "#2c3744" }}
              dangerouslySetInnerHTML={{ __html: sanitizePostHtml(post.bodyHtml || "") }}
            />

            {/* Lead-form CTA */}
            <div style={{ marginTop: 44, background: "#fff", border: "1px solid #eef1f5", borderRadius: 16, padding: 24, boxShadow: "0 20px 50px rgba(5,12,24,.08)" }}>
              <div style={{ fontFamily: "var(--head)", fontSize: 20, fontWeight: 800, color: "#0f1b29", lineHeight: 1.2 }}>
                Get our best deals first
              </div>
              <p style={{ fontSize: 14, color: "#5a6675", marginTop: 8 }}>
                Join {brandName}&apos;s buyers list — free, by text and email.
              </p>
              <div style={{ marginTop: 16 }}>
                <LeadForm inline ctaLabel="Join the list" />
              </div>
            </div>
          </div>
        </main>

        <SiteFooter />
      </SiteContextProvider>
    </div>
  )
}
