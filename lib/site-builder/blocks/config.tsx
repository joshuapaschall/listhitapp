import React from "react"
import type { Config } from "@measured/puck"
import { themeToCssVars } from "../theme"
import { WRAP, HEADING } from "./primitives"
import { LeadForm } from "@/components/sites/lead-form"
import { DealsSection } from "@/components/sites/deals-section"
import { SiteFooter } from "@/components/sites/site-footer"
import { siteImage, siteSrcSet } from "@/lib/site-builder/image-url"


// ---------------------------------------------------------------------------
// Shared primitives — every block is self-contained and token-driven. Styling
// reads the CSS variables --p (primary), --a (accent), --head (heading font)
// that Root sets, so this config renders identically in the dashboard editor
// and in the standalone public site app. No Tailwind, no globals.css.
// ---------------------------------------------------------------------------


export const siteConfig: Config = {
  root: {
    fields: {
      primary: { type: "text", label: "Primary color" },
      accent: { type: "text", label: "Accent color" },
      headingFont: { type: "text", label: "Heading font" },
      bodyFont: { type: "text", label: "Body font" },
    },
    defaultProps: {
      primary: "#173b5e",
      accent: "#e8833a",
      headingFont: "'Bricolage Grotesque', serif",
      bodyFont: "'Source Sans 3', sans-serif",
    },
    render: ({ primary, accent, headingFont, bodyFont, children }: any) => (
      <div
        style={{
          ...themeToCssVars({
            primary: primary || "#0f2a43",
            accent: accent || "#f5a623",
            headingFont: headingFont || "'Montserrat', sans-serif",
            bodyFont: bodyFont || "'Source Sans 3', sans-serif",
          }),
          fontFamily: "var(--body)",
          color: "#0f1b29",
          background: "#fff",
        }}
      >
        {children}
      </div>
    ),
  },

  components: {
    // -----------------------------------------------------------------------
    Nav: {
      label: "Nav",
      permissions: { delete: false, drag: false, duplicate: false },
      fields: {
        brandName: { type: "text", label: "Business name" },
        logoUrl: { type: "text", label: "Logo URL" },
        phone: { type: "text", label: "Phone number" },
        links: {
          type: "array",
          label: "Menu links",
          arrayFields: { label: { type: "text", label: "Label" }, href: { type: "text", label: "Link" } },
          getItemSummary: (item: any, i?: number) => item?.label || `Item ${(i ?? 0) + 1}`,
        },
        layout: {
          type: "select",
          label: "Header layout",
          options: [
            { label: "Split", value: "split" },
            { label: "Center", value: "center" },
            { label: "Stack", value: "stack" },
          ],
        },
      },
      defaultProps: {
        brandName: "Your Company",
        logoUrl: "",
        phone: "(555) 555-5555",
        links: [{ label: "Deals", href: "/properties" }, { label: "Contact", href: "/contact" }],
        layout: "split",
      },
      render: ({ brandName, logoUrl, phone, links, layout }: any) => {
        const isCenter = layout === "center"
        const isStack = layout === "stack"
        const brand = (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} style={{ height: 30 }} />
            ) : null}
            <span style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 20, color: "var(--p)" }}>
              {brandName}
            </span>
          </div>
        )
        const linkRow = (
          <nav className="lh-nav-links" style={{ display: "flex", gap: 22, alignItems: "center" }}>
            {(links || []).map((l: any, i: number) => (
              // eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site
              <a key={i} href={l?.href || "#"} style={{ color: "#3a4554", textDecoration: "none", fontSize: 14.5 }}>
                {l?.label}
              </a>
            ))}
            {phone && (
              <a
                href={`tel:${phone}`}
                style={{ color: "var(--p)", fontWeight: 700, textDecoration: "none", fontSize: 14.5 }}
              >
                {phone}
              </a>
            )}
          </nav>
        )
        return (
          <header style={{ borderBottom: "1px solid #eef1f5", background: "#fff" }}>
            <div
              className="lh-nav"
              style={{
                ...WRAP,
                display: "flex",
                flexDirection: isStack ? "column" : "row",
                alignItems: "center",
                justifyContent: isCenter ? "center" : "space-between",
                gap: 12,
                padding: "16px 24px",
                textAlign: isCenter ? "center" : "left",
              }}
            >
              {brand}
              {linkRow}
            </div>
          </header>
        )
      },
    },

    // -----------------------------------------------------------------------
    Hero: {
      label: "Hero",
      permissions: { delete: false, drag: false, duplicate: false },
      fields: {
        variant: {
          type: "select",
          label: "Layout",
          options: [
            { label: "Photo", value: "photo" },
            { label: "Centered", value: "centered" },
            { label: "Split", value: "split" },
            { label: "Band", value: "band" },
          ],
        },
        eyebrow: { type: "text", label: "Eyebrow tag", contentEditable: true },
        headline: { type: "textarea", label: "Headline", contentEditable: true },
        subhead: { type: "textarea", label: "Subheadline", contentEditable: true },
        stat: { type: "text", label: "Trust badge", contentEditable: true },
        imageUrl: { type: "text", label: "Background image URL" },
        formTitle: { type: "text", label: "Form title" },
        formSubtitle: { type: "text", label: "Form subtitle" },
        ctaLabel: { type: "text", label: "Button text" },
      },
      defaultProps: {
        variant: "photo",
        eyebrow: "Off-market deals",
        headline: "Get first access to deeply discounted properties.",
        subhead: "Join the buyers list and we'll send wholesale-priced, off-market deals straight to your phone — before anyone else sees them.",
        stat: "New deals, sent to the list first",
        imageUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600",
        formTitle: "See this week's deals",
        formSubtitle: "Step 1 of 2 — where should we send them?",
        ctaLabel: "Unlock the deals",
      },
      render: ({ variant, eyebrow, headline, subhead, stat, imageUrl, formTitle, formSubtitle, ctaLabel }: any) => {
        const eyebrowEl = eyebrow ? (
          <div
            style={{
              display: "inline-block",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--a)",
              marginBottom: 12,
            }}
          >
            {eyebrow}
          </div>
        ) : null

        const h = (color: string, extra?: React.CSSProperties) => (
          <h1 className="lh-hero-h1" style={{ ...HEADING, fontSize: 44, fontWeight: 800, color, margin: 0, ...extra }}>{headline}</h1>
        )
        const sub = (color: string) => (
          <p style={{ fontSize: 18, lineHeight: 1.5, color, marginTop: 14, maxWidth: 520 }}>{subhead}</p>
        )

        // Eyebrow for dark heroes: white label with an accent dot + halo.
        const eyebrowDark = eyebrow ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              fontFamily: "var(--body)",
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "#fff",
              marginBottom: 22,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--a)",
                boxShadow: "0 0 0 4px color-mix(in srgb, var(--a) 30%, transparent)",
              }}
            />
            {eyebrow}
          </div>
        ) : null

        // Social-proof row built from `stat`: decorative avatars + stars + the stat line.
        const trustRow = () =>
          stat ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                marginTop: 28,
                padding: "10px 16px",
                borderRadius: 999,
                background: "rgba(255,255,255,.10)",
                border: "1px solid rgba(255,255,255,.18)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--a)",
                  boxShadow: "0 0 0 4px color-mix(in srgb, var(--a) 30%, transparent)",
                }}
              />
              <span style={{ fontSize: 14, color: "rgba(255,255,255,.88)", fontWeight: 600 }}>{stat}</span>
            </div>
          ) : null

        if (variant === "photo") {
          const scrim = "linear-gradient(90deg, rgba(10,15,24,.92) 0%, rgba(10,15,24,.55) 45%, rgba(10,15,24,.20) 100%)"
          const themedFallback =
            "radial-gradient(120% 90% at 78% 18%, color-mix(in srgb, var(--a) 22%, transparent), transparent 55%)," +
            "radial-gradient(120% 90% at 18% 92%, color-mix(in srgb, var(--p) 45%, #000), transparent 60%)," +
            "linear-gradient(115deg, color-mix(in srgb, var(--p) 78%, #000), color-mix(in srgb, var(--p) 90%, #000))"
          const heroSrc = imageUrl ? (siteImage(imageUrl, { width: 1920, quality: 80 }) ?? imageUrl) : null
          const background = heroSrc ? `${scrim}, url(${heroSrc})` : themedFallback
          return (
            <>
            {heroSrc ? <link rel="preload" as="image" href={heroSrc} fetchPriority="high" /> : null}
            <section
              id="join"
              className="lh-hero-photo"
              style={{
                position: "relative",
                minHeight: 720,
                display: "flex",
                alignItems: "center",
                background,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div
                className="lh-hero-grid"
                style={{
                  ...WRAP,
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "1.15fr .85fr",
                  gap: 52,
                  alignItems: "center",
                  padding: "110px 24px 90px",
                }}
              >
                <div>
                  {eyebrowDark}
                  <h1
                    className="lh-hero-h1"
                    style={{
                      fontFamily: "var(--head)",
                      fontSize: "clamp(38px, 5vw, 58px)",
                      fontWeight: 700,
                      lineHeight: 1.04,
                      letterSpacing: "-.02em",
                      color: "#fff",
                      margin: 0,
                    }}
                  >
                    {headline}
                  </h1>
                  {subhead && (
                    <p style={{ fontFamily: "var(--body)", fontSize: 18, lineHeight: 1.6, color: "rgba(255,255,255,.80)", marginTop: 18, maxWidth: 520 }}>
                      {subhead}
                    </p>
                  )}
                  {trustRow()}
                </div>
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 20,
                    padding: "30px 28px",
                    boxShadow: "0 30px 70px rgba(5,12,24,.40)",
                    border: "1px solid #eef1f5",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--a)",
                      background: "color-mix(in srgb, var(--a) 12%, #fff)",
                      padding: "6px 12px",
                      borderRadius: 999,
                      marginBottom: 16,
                    }}
                  >
                    Free — instant access
                  </div>
                  <LeadForm title={formTitle} subtitle={formSubtitle} ctaLabel={ctaLabel} />
                </div>
              </div>
            </section>
            </>
          )
        }

        if (variant === "centered") {
          return (
            <section id="join" style={{ background: "color-mix(in srgb, var(--p) 7%, #fff)" }}>
              <div style={{ ...WRAP, padding: "72px 24px", textAlign: "center" }}>
                {eyebrowEl}
                <h1 className="lh-hero-h1" style={{ ...HEADING, fontSize: 40, fontWeight: 800, color: "var(--p)", margin: "0 auto", maxWidth: 960, marginInline: "auto", textWrap: "balance" } as React.CSSProperties}>
                  {headline}
                </h1>
                <p style={{ fontSize: 18, lineHeight: 1.5, color: "#42505f", margin: "14px auto 0", maxWidth: 600 }}>
                  {subhead}
                </p>
                <div style={{ maxWidth: 720, margin: "24px auto 0" }}>
                  <LeadForm title={formTitle} subtitle={formSubtitle} ctaLabel={ctaLabel} inline />
                </div>
              </div>
            </section>
          )
        }

        if (variant === "split") {
          return (
            <section id="join" style={{ background: "#fff" }}>
              <div
                className="lh-grid-2"
                style={{
                  ...WRAP,
                  display: "grid",
                  gridTemplateColumns: "minmax(280px,400px) minmax(0,1fr)",
                  gap: 40,
                  alignItems: "center",
                  padding: "64px 24px",
                }}
              >
                <div>
                  {eyebrowEl}
                  {h("var(--p)")}
                  {sub("#42505f")}
                  <div style={{ marginTop: 20 }}>
                    <LeadForm title={formTitle} subtitle={formSubtitle} ctaLabel={ctaLabel} />
                  </div>
                </div>
                <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", minHeight: 360 }}>
                  <img
                    src={siteImage(imageUrl, { width: 900, quality: 80 })}
                    srcSet={siteSrcSet(imageUrl, [600, 900, 1200], 80)}
                    sizes="(max-width: 900px) 100vw, 400px"
                    alt=""
                    width={800}
                    height={600}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 360 }}
                  />
                  {stat && (
                    <div
                      style={{
                        position: "absolute",
                        left: 18,
                        bottom: 18,
                        background: "rgba(11,22,36,.82)",
                        color: "#fff",
                        padding: "10px 14px",
                        borderRadius: 12,
                        fontWeight: 700,
                      }}
                    >
                      {stat}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        }

        // band
        return (
          <section id="join">
            <div style={{ background: "var(--p)" }}>
              <div
                className="lh-grid-2"
                style={{
                  ...WRAP,
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) minmax(280px,420px)",
                  gap: 36,
                  alignItems: "center",
                  padding: "56px 24px",
                }}
              >
                <div>
                  {eyebrow && (
                    <div style={{ color: "var(--a)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", fontSize: 13, marginBottom: 10 }}>
                      {eyebrow}
                    </div>
                  )}
                  {h("#fff", { fontSize: 40, maxWidth: 960, marginInline: "auto", textWrap: "balance" } as React.CSSProperties)}
                  {sub("rgba(255,255,255,.86)")}
                  {stat && <div style={{ marginTop: 16, color: "#fff", fontWeight: 700 }}>{stat}</div>}
                </div>
                <LeadForm title={formTitle} subtitle={formSubtitle} ctaLabel={ctaLabel} />
              </div>
            </div>
          </section>
        )
      },
    },

    // -----------------------------------------------------------------------
    TrustBar: {
      label: "Stats strip",
      fields: {
        items: {
          type: "array",
          label: "Stats",
          arrayFields: {
            value: { type: "text", label: "Value" },
            label: { type: "text", label: "Label" },
          },
          getItemSummary: (item: any, i?: number) =>
            [item?.value, item?.label].filter(Boolean).join(" — ") || item?.label || `Item ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: {
        items: [
          { value: "$0", label: "Fees to join" },
          { value: "<24h", label: "New deals to your inbox" },
          { value: "All cash", label: "Fast, certain closings" },
          { value: "Off-market", label: "Deals you won't find online" },
        ],
      },
      render: ({ items }: any) => {
        const list = (items || []).filter((it: any) => it && (it.value || it.label))
        if (list.length === 0) return <></>

        return (
          <div
            style={{
              background: "color-mix(in srgb, var(--p) 5%, #ffffff)",
              borderTop: "1px solid color-mix(in srgb, var(--p) 12%, transparent)",
              borderBottom: "1px solid color-mix(in srgb, var(--p) 12%, transparent)",
            }}
          >
            <div
              style={{
                ...WRAP,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "flex-start",
                gap: "28px 48px",
                padding: "34px 24px",
              }}
            >
              {list.map((it: any, i: number) => (
                <div key={i} style={{ flex: "0 1 auto", minWidth: 130, textAlign: "center" }}>
                  {it.value ? (
                    <div
                      style={{
                        fontFamily: "var(--head)",
                        fontSize: 34,
                        lineHeight: 1.05,
                        fontWeight: 800,
                        color: "var(--p)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {it.value}
                    </div>
                  ) : null}
                  <div
                    style={{
                      marginTop: it.value ? 7 : 0,
                      fontFamily: "var(--body)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#5b6470",
                    }}
                  >
                    {it.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      },
    },

    // -----------------------------------------------------------------------
    FeatureGrid: {
      label: "Feature grid",
      fields: {
        heading: { type: "text", label: "Section heading", contentEditable: true },
        features: {
          type: "array",
          label: "Cards",
          arrayFields: {
            icon: { type: "text", label: "Icon" },
            title: { type: "text", label: "Title" },
            body: { type: "textarea", label: "Body" },
          },
          getItemSummary: (item: any, i?: number) => item?.title || `Item ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: {
        heading: "Why buyers join the list",
        features: [
          { icon: "⚡", title: "You move first", body: "New off-market deals hit your phone the moment we lock them up — before anyone else." },
          { icon: "📊", title: "Numbers up front", body: "Every deal comes with the price, the repairs, and the ARV already run." },
          { icon: "💵", title: "Free to join", body: "No fees, no contract. We make our money on the deals, not on the list." },
        ],
      },
      render: ({ heading, features }: any) => (
        <section style={{ background: "#fff" }}>
          <div style={{ ...WRAP, padding: "64px 24px" }}>
            {heading && (
              <h2 className="lh-h2" style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", textAlign: "center", margin: "0 0 36px" }}>
                {heading}
              </h2>
            )}
            <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
              {(features || []).map((f: any, i: number) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #eef1f5",
                    borderRadius: 16,
                    padding: 24,
                    boxShadow: "0 8px 24px rgba(16,27,41,.05)",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "color-mix(in srgb, var(--p) 12%, #fff)",
                      fontSize: 22,
                      marginBottom: 14,
                    }}
                  >
                    {f?.icon}
                  </div>
                  <div style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 18, color: "#0f1b29" }}>{f?.title}</div>
                  <p style={{ color: "#5a6675", fontSize: 14.5, lineHeight: 1.55, marginTop: 8 }}>{f?.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ),
    },

    // -----------------------------------------------------------------------
    AnnouncementBar: {
      label: "Announcement bar",
      fields: {
        text: { type: "text", label: "Text", contentEditable: true },
        enabled: {
          type: "radio",
          label: "Show banner",
          options: [
            { label: "Show", value: "show" },
            { label: "Hide", value: "hide" },
          ],
        },
      },
      defaultProps: { text: "", enabled: "show" },
      render: ({ text, enabled }: any) => {
        if (enabled !== "show" || !text) return <></>
        return (
          <div
            style={{
              background: "var(--a)",
              color: "var(--a-ink)",
              textAlign: "center",
              fontFamily: "var(--body)",
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 16px",
            }}
          >
            {text}
          </div>
        )
      },
    },

    // -----------------------------------------------------------------------
    HowItWorks: {
      label: "How it works",
      fields: {
        heading: { type: "text", label: "Section heading", contentEditable: true },
        steps: {
          type: "array",
          label: "Steps",
          arrayFields: {
            title: { type: "text", label: "Title" },
            body: { type: "textarea", label: "Body" },
          },
          getItemSummary: (item: any, i?: number) => item?.title || `Item ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: {
        heading: "How it works",
        steps: [
          { title: "Join the list", body: "Tell us what you're looking for — it's free." },
          { title: "Get matched", body: "We send the deals that fit, by text and email." },
          { title: "Move first", body: "Reply to claim it and we take it from there." },
        ],
      },
      render: ({ heading, steps }: any) => (
        <section id="how-it-works" style={{ background: "#fff" }}>
          <div style={{ ...WRAP, padding: "64px 24px" }}>
            {heading && (
              <h2 className="lh-h2" style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", textAlign: "center", margin: "0 0 36px" }}>
                {heading}
              </h2>
            )}
            <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
              {(steps || []).map((s: any, i: number) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: "var(--p)",
                      color: "#fff",
                      fontFamily: "var(--head)",
                      fontWeight: 800,
                      fontSize: 18,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 18, color: "#0f1b29" }}>{s?.title}</div>
                  <div style={{ fontFamily: "var(--body)", fontSize: 15, lineHeight: 1.55, color: "#5a6675" }}>{s?.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ),
    },

    // -----------------------------------------------------------------------
    Faq: {
      label: "FAQ",
      fields: {
        heading: { type: "text", label: "Section heading", contentEditable: true },
        items: {
          type: "array",
          label: "Questions",
          arrayFields: {
            q: { type: "text", label: "Question" },
            a: { type: "textarea", label: "Answer" },
          },
          getItemSummary: (item: any, i?: number) => item?.q || `Item ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: {
        heading: "Questions & answers",
        items: [
          { q: "Is it free to join?", a: "Yes — free to join, no obligation." },
          { q: "How do I get off the list?", a: "Reply STOP to any text and you're out instantly." },
        ],
      },
      render: ({ heading, items }: any) => (
        <section style={{ background: "#fff" }}>
          <div style={{ ...WRAP, padding: "64px 24px", maxWidth: 820 }}>
            {heading && (
              <h2 className="lh-h2" style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", textAlign: "center", margin: "0 0 32px" }}>
                {heading}
              </h2>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(items || []).map((it: any, i: number) => (
                <details key={i} style={{ borderBottom: "1px solid #eef1f5", padding: "10px 0" }}>
                  <summary style={{ cursor: "pointer", fontFamily: "var(--head)", fontWeight: 700, fontSize: 16, color: "var(--p)", listStyle: "none" }}>
                    {it?.q}
                  </summary>
                  <div style={{ marginTop: 10, fontFamily: "var(--body)", fontSize: 15, lineHeight: 1.6, color: "#5a6675" }}>{it?.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      ),
    },

    // -----------------------------------------------------------------------
    AboutStory: {
      label: "About story",
      fields: {
        headline: { type: "text", label: "Headline", contentEditable: true },
        body: { type: "textarea", label: "Body text", contentEditable: true },
        trust: {
          type: "array",
          label: "Trust points",
          arrayFields: { text: { type: "text", label: "Text" } },
          getItemSummary: (item: any, i?: number) => item?.text || `Item ${(i ?? 0) + 1}`,
        },
        stats: {
          type: "array",
          label: "Stats",
          arrayFields: { value: { type: "text", label: "Value" }, label: { type: "text", label: "Label" } },
          getItemSummary: (item: any, i?: number) => item?.label || item?.value || `Item ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: {
        headline: "Built for buyers who close.",
        body: "We find the deals and pass them straight to our list — no markups, no bidding wars, just clean opportunities for serious buyers.",
        trust: [],
        stats: [],
      },
      render: ({ headline, body, trust, stats }: any) => (
        <section style={{ background: "#fff" }}>
          <div style={{ ...WRAP, padding: "64px 24px" }}>
            {headline && (
              <h2 className="lh-h2" style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", textAlign: "center", margin: "0 0 18px" }}>
                {headline}
              </h2>
            )}
            {body && (
              <p style={{ fontFamily: "var(--body)", fontSize: 17, lineHeight: 1.65, color: "#5a6675", textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
                {body}
              </p>
            )}
            {stats?.length ? (
              <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22, marginTop: 40 }}>
                {stats.map((s: any, i: number) => (
                  <div key={i} style={{ textAlign: "center", border: "1px solid #eef1f5", borderRadius: 16, padding: 24, background: "#fff" }}>
                    <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 34, lineHeight: 1.05, color: "var(--p)" }}>{s?.value}</div>
                    <div style={{ marginTop: 6, fontFamily: "var(--body)", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#5b6470" }}>{s?.label}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {trust?.length ? (
              <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22, marginTop: 40 }}>
                {trust.map((t: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid #eef1f5", borderRadius: 16, padding: 20, background: "#fff", boxShadow: "0 8px 24px rgba(16,27,41,.05)" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "color-mix(in srgb, var(--a) 18%, #fff)",
                        color: "var(--a)",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                    <span style={{ fontFamily: "var(--body)", fontSize: 15, fontWeight: 600, color: "#0f1b29" }}>{t?.text}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ),
    },

    // -----------------------------------------------------------------------
    PropertyGrid: {
      label: "Property grid",
      fields: {
        heading: { type: "text", label: "Section heading" },
      },
      defaultProps: { heading: "Recent deals" },
      render: ({ heading }: any) => <DealsSection heading={heading} />,
    },

    // -----------------------------------------------------------------------
    CtaBand: {
      label: "CTA band",
      fields: {
        heading: { type: "text", label: "Section heading", contentEditable: true },
        body: { type: "textarea", label: "Body text", contentEditable: true },
        buttonLabel: { type: "text", label: "Button text", contentEditable: true },
        buttonHref: { type: "text", label: "Button link" },
      },
      defaultProps: {
        heading: "Ready to see the deals?",
        body: "Join the buyers list and get new off-market deals by text and email — free, no contract.",
        buttonLabel: "Join the buyers list",
        buttonHref: "/#join",
      },
      render: ({ heading, body, buttonLabel, buttonHref }: any) => (
        <section style={{ background: "var(--p)" }}>
          <div style={{ ...WRAP, padding: "56px 24px", textAlign: "center" }}>
            <h2 className="lh-h2" style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "#fff", margin: 0 }}>{heading}</h2>
            {body && <p style={{ color: "rgba(255,255,255,.85)", fontSize: 17, marginTop: 12, maxWidth: 560, marginInline: "auto" }}>{body}</p>}
            <a
              href={buttonHref || "/#join"}
              style={{
                marginTop: 22,
                padding: "14px 28px",
                borderRadius: 10,
                border: "none",
                background: "var(--a)",
                color: "var(--a-ink)",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              {buttonLabel}
            </a>
          </div>
        </section>
      ),
    },

    // -----------------------------------------------------------------------
    ProseSection: {
      label: "Prose section",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        heading: { type: "text", label: "Section heading", contentEditable: true },
        bodyHtml: { type: "textarea", label: "Body (HTML)" },
        pullQuote: { type: "text", label: "Pull quote" },
        ctaText: { type: "text", label: "CTA text" },
        ctaHref: { type: "text", label: "CTA link" },
      },
      defaultProps: {
        eyebrow: "Section label",
        heading: "Section heading",
        bodyHtml: "<p>Add your long-form, keyword-rich copy here.</p>",
        pullQuote: "",
        ctaText: "",
        ctaHref: "",
      },
      render: ({ eyebrow, heading, bodyHtml, pullQuote, ctaText, ctaHref }: any) => (
        <section style={{ background: "#fff" }}>
          <div style={{ ...WRAP, padding: "64px 24px" }}>
            <div className="lh-grid-2" style={{ display: "grid", gridTemplateColumns: "minmax(0, 360px) minmax(0, 1fr)", gap: 40, alignItems: "start" }}>
              <div>
                {eyebrow ? (
                  <div style={{ fontFamily: "var(--body)", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--a)", marginBottom: 12 }}>
                    {eyebrow}
                  </div>
                ) : null}
                {heading ? (
                  <h2 className="lh-h2" style={{ ...HEADING, fontSize: 30, fontWeight: 800, color: "var(--p)", margin: 0 }}>
                    {heading}
                  </h2>
                ) : null}
                {pullQuote ? (
                  <blockquote style={{ borderLeft: "3px solid var(--a)", paddingLeft: 16, margin: "20px 0 0", fontFamily: "var(--head)", fontSize: 17, lineHeight: 1.4, color: "#2c3744" }}>
                    {pullQuote}
                  </blockquote>
                ) : null}
              </div>
              <div>
                <div
                  className="lh-prose"
                  style={{ fontFamily: "var(--body)", fontSize: 16, lineHeight: 1.7, color: "#42505f" }}
                  dangerouslySetInnerHTML={{ __html: bodyHtml || "" }}
                />
                {ctaText ? (
                  <a href={ctaHref || "#"} style={{ display: "inline-block", marginTop: 20, fontFamily: "var(--head)", fontWeight: 700, fontSize: 15, color: "var(--p)", textDecoration: "none" }}>
                    {ctaText} →
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ),
    },

    // -----------------------------------------------------------------------
    TypesGrid: {
      label: "Types grid",
      fields: {
        heading: { type: "text", label: "Section heading", contentEditable: true },
        intro: { type: "textarea", label: "Intro" },
        items: {
          type: "array",
          label: "Cards",
          arrayFields: {
            title: { type: "text", label: "Title" },
            body: { type: "textarea", label: "Body" },
            href: { type: "text", label: "Link" },
          },
          getItemSummary: (item: any, i?: number) => item?.title || `Item ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: {
        heading: "Section heading",
        intro: "",
        items: [],
      },
      render: ({ heading, intro, items }: any) => {
        const list = (items || []).filter((it: any) => it && (it.title || it.body))
        if (list.length === 0) return <></>
        return (
          <section style={{ background: "#fff" }}>
            <div style={{ ...WRAP, padding: "64px 24px" }}>
              {heading ? (
                <h2 className="lh-h2" style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", textAlign: "center", margin: "0 0 12px" }}>
                  {heading}
                </h2>
              ) : null}
              {intro ? (
                <p style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 36px", fontSize: 15.5, lineHeight: 1.6, color: "#5a6675" }}>
                  {intro}
                </p>
              ) : null}
              <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
                {list.map((it: any, i: number) => (
                  <div
                    key={i}
                    style={{ border: "1px solid #eef1f5", borderRadius: 16, padding: 24, boxShadow: "0 8px 24px rgba(16,27,41,.05)", background: "#fff" }}
                  >
                    <div style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 18, color: "var(--p)" }}>{it?.title}</div>
                    <p style={{ color: "#5a6675", fontSize: 14.5, lineHeight: 1.55, marginTop: 8 }}>{it?.body}</p>
                    {it?.href ? (
                      <a href={it.href} style={{ display: "inline-block", marginTop: 12, fontFamily: "var(--head)", fontWeight: 700, fontSize: 14, color: "var(--p)", textDecoration: "none" }}>
                        Browse →
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      },
    },

    // -----------------------------------------------------------------------
    SituationsGrid: {
      label: "Situations grid",
      fields: {
        heading: { type: "text", label: "Section heading", contentEditable: true },
        intro: { type: "textarea", label: "Intro" },
        items: {
          type: "array",
          label: "Situations",
          arrayFields: {
            icon: { type: "text", label: "Icon (emoji)" },
            title: { type: "text", label: "Title" },
            body: { type: "textarea", label: "Body" },
            href: { type: "text", label: "Link" },
          },
          getItemSummary: (item: any, i?: number) => item?.title || `Item ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: { heading: "Situations we buy", intro: "", items: [] },
      render: ({ heading, intro, items }: any) => {
        const list = (items || []).filter((it: any) => it && (it.title || it.body))
        if (list.length === 0) return <></>
        return (
          <section style={{ background: "#fff" }}>
            <div style={{ ...WRAP, padding: "64px 24px" }}>
              <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 40px" }}>
                {heading ? (
                  <h2 className="lh-h2" style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", margin: 0 }}>{heading}</h2>
                ) : null}
                {intro ? (
                  <p style={{ fontSize: 16, color: "#5a6675", marginTop: 12, lineHeight: 1.6 }}>{intro}</p>
                ) : null}
              </div>
              <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 18 }}>
                {list.map((it: any, i: number) => (
                  <div key={i} style={{ border: "1px solid #eef1f5", borderRadius: 14, padding: "22px 22px", background: "#fff" }}>
                    {it?.icon ? <div style={{ fontSize: 22, marginBottom: 10 }}>{it.icon}</div> : null}
                    <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 16.5, color: "var(--p)" }}>{it?.title}</div>
                    {it?.body ? <p style={{ color: "#5a6675", fontSize: 14, lineHeight: 1.6, marginTop: 7 }}>{it.body}</p> : null}
                    {it?.href ? (
                      <a href={it.href} style={{ display: "inline-block", marginTop: 10, fontFamily: "var(--head)", fontWeight: 700, fontSize: 13.5, color: "var(--a)", textDecoration: "none" }}>
                        Learn more →
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      },
    },

    // -----------------------------------------------------------------------
    AreasServed: {
      label: "Areas served",
      fields: {
        heading: { type: "text", label: "Section heading" },
        intro: { type: "textarea", label: "Intro" },
        singleLine: { type: "text", label: "Single-market sentence" },
        areas: {
          type: "array",
          label: "Areas",
          arrayFields: {
            label: { type: "text", label: "Label" },
            href: { type: "text", label: "Link" },
          },
          getItemSummary: (item: any, i?: number) => item?.label || `Item ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: {
        heading: "Where we find deals",
        intro: "",
        singleLine: "",
        areas: [],
      },
      render: ({ heading, intro, areas, singleLine }: any) => {
        const list = (areas || []).filter((a: any) => a && a.label)
        const hasMany = list.length >= 1
        if (!hasMany && !singleLine) return <></>
        return (
          <section style={{ background: "color-mix(in srgb, var(--p) 5%, #fff)" }}>
            <div style={{ ...WRAP, padding: "56px 24px", textAlign: "center" }}>
              {heading ? (
                <h2 className="lh-h2" style={{ ...HEADING, fontSize: 30, fontWeight: 800, color: "var(--p)", margin: "0 0 12px" }}>
                  {heading}
                </h2>
              ) : null}
              {hasMany ? (
                <>
                  {intro ? (
                    <p style={{ maxWidth: 640, margin: "0 auto 24px", fontSize: 15.5, lineHeight: 1.6, color: "#5a6675" }}>
                      {intro}
                    </p>
                  ) : null}
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
                    {list.map((a: any, i: number) => {
                      const chip = (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "8px 16px",
                            borderRadius: 999,
                            background: "#fff",
                            border: "1px solid color-mix(in srgb, var(--p) 14%, transparent)",
                            fontFamily: "var(--body)",
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--p)",
                          }}
                        >
                          {a.label}
                        </span>
                      )
                      return a.href ? (
                        <a key={i} href={a.href} style={{ textDecoration: "none" }}>{chip}</a>
                      ) : (
                        <span key={i}>{chip}</span>
                      )
                    })}
                  </div>
                </>
              ) : (
                <p style={{ maxWidth: 640, margin: "0 auto", fontSize: 16, lineHeight: 1.6, color: "#5a6675" }}>
                  {singleLine}
                </p>
              )}
            </div>
          </section>
        )
      },
    },

    // -----------------------------------------------------------------------
    ReviewsWall: {
      label: "Reviews wall",
      fields: {
        heading: { type: "text", label: "Section heading", contentEditable: true },
        emptyText: { type: "text", label: "Empty state message" },
        reviews: {
          type: "array",
          label: "Reviews",
          arrayFields: {
            quote: { type: "textarea", label: "Quote" },
            author: { type: "text", label: "Author" },
            meta: { type: "text", label: "Meta" },
          },
          getItemSummary: (item: any, i?: number) => item?.quote || item?.author || `Item ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: {
        heading: "What buyers say",
        emptyText: "No reviews yet — they'll appear here as buyers close deals from the list.",
        reviews: [],
      },
      render: ({ heading, reviews, emptyText }: any) => {
        const list = (reviews || []).filter((r: any) => r && (r.quote || r.author))
        return (
          <section style={{ background: "#f7f8fa" }}>
            <div style={{ ...WRAP, padding: "64px 24px" }}>
              {heading ? (
                <h2 className="lh-h2" style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", textAlign: "center", margin: "0 0 36px" }}>
                  {heading}
                </h2>
              ) : null}
              {list.length === 0 ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 22, color: "var(--p)", marginBottom: 28 }}>
                    Why buyers join the list
                  </div>
                  <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 18 }}>
                    {[
                      { icon: "🆓", label: "Free to join", sub: "No fees, ever" },
                      { icon: "📲", label: "Deals by text and email", sub: "In under 24h" },
                      { icon: "🚫", label: "No spam", sub: "STOP anytime" },
                      { icon: "📊", label: "Numbers up front", sub: "Price, repairs, ARV" },
                    ].map((s, i) => (
                      <div key={i} style={{ background: "#fff", border: "1px solid #eef1f5", borderRadius: 14, padding: "20px 16px" }}>
                        <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                        <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 14.5, color: "var(--p)" }}>{s.label}</div>
                        <div style={{ fontSize: 12.5, color: "#8a94a2", marginTop: 3 }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
                  {list.map((r: any, i: number) => (
                    <div
                      key={i}
                      style={{ background: "#fff", border: "1px solid #eef1f5", borderRadius: 16, padding: 24, boxShadow: "0 8px 24px rgba(16,27,41,.05)" }}
                    >
                      <div style={{ fontFamily: "var(--body)", fontSize: 15, lineHeight: 1.6, color: "#2c3744" }}>{r?.quote}</div>
                      {r?.author ? (
                        <div style={{ marginTop: 14, fontFamily: "var(--head)", fontWeight: 700, fontSize: 14, color: "var(--p)" }}>— {r.author}</div>
                      ) : null}
                      {r?.meta ? (
                        <div style={{ marginTop: 2, fontSize: 12.5, color: "#8a94a2" }}>{r.meta}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      },
    },

    // -----------------------------------------------------------------------
    RecentPosts: {
      label: "Recent posts",
      fields: {
        heading: { type: "text", label: "Section heading" },
        intro: { type: "textarea", label: "Intro" },
        posts: {
          type: "array",
          label: "Posts",
          arrayFields: {
            title: { type: "text", label: "Title" },
            date: { type: "text", label: "Date" },
            href: { type: "text", label: "Link" },
            imageUrl: { type: "text", label: "Image URL" },
          },
          getItemSummary: (item: any, i?: number) => item?.title || `Item ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: {
        heading: "From the blog",
        intro: "",
        posts: [],
      },
      render: ({ heading, intro, posts }: any) => {
        const list = (posts || []).filter((p: any) => p && p.title)
        if (list.length === 0) {
          // No posts yet → a "Start here" resources rail of internal links, so
          // the section stays present and adds internal links before the operator blogs.
          const rail = [
            { title: "How it works", href: "/how-it-works" },
            { title: "Common questions", href: "/faq" },
            { title: "About us", href: "/about" },
            { title: "Browse deals", href: "/properties" },
          ]
          return (
            <section style={{ background: "#fff" }}>
              <div style={{ ...WRAP, padding: "64px 24px" }}>
                <h2 className="lh-h2" style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", textAlign: "center", margin: "0 0 36px" }}>
                  Start here
                </h2>
                <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 18 }}>
                  {rail.map((r) => (
                    // eslint-disable-next-line @next/next/no-html-link-for-pages -- public tenant site, not a dashboard route
                    <a
                      key={r.href}
                      href={r.href}
                      style={{ display: "block", border: "1px solid #eef1f5", borderRadius: 14, padding: "22px 20px", background: "#fff", textDecoration: "none" }}
                    >
                      <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 16.5, color: "var(--p)" }}>{r.title}</div>
                      <div style={{ marginTop: 8, fontFamily: "var(--head)", fontWeight: 700, fontSize: 13.5, color: "var(--a)" }}>Learn more →</div>
                    </a>
                  ))}
                </div>
              </div>
            </section>
          )
        }
        const placeholder =
          "radial-gradient(120% 90% at 78% 18%, color-mix(in srgb, var(--a) 22%, transparent), transparent 55%)," +
          "linear-gradient(115deg, color-mix(in srgb, var(--p) 70%, #000), color-mix(in srgb, var(--p) 88%, #000))"
        return (
          <section style={{ background: "#fff" }}>
            <div style={{ ...WRAP, padding: "64px 24px" }}>
              {heading ? (
                <h2 className="lh-h2" style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", textAlign: "center", margin: "0 0 12px" }}>
                  {heading}
                </h2>
              ) : null}
              {intro ? (
                <p style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 36px", fontSize: 15.5, lineHeight: 1.6, color: "#5a6675" }}>
                  {intro}
                </p>
              ) : null}
              <div className="lh-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
                {list.map((p: any, i: number) => {
                  const src = p.imageUrl ? (siteImage(p.imageUrl, { width: 800, quality: 80 }) ?? p.imageUrl) : null
                  const card = (
                    <>
                      <div style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: 14, overflow: "hidden", background: placeholder }}>
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt=""
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).remove() }}
                          />
                        ) : null}
                      </div>
                      {p.date ? (
                        <div style={{ marginTop: 12, fontFamily: "var(--mono, monospace)", fontSize: 12, color: "#8a94a2" }}>{p.date}</div>
                      ) : null}
                      <div style={{ marginTop: 4, fontFamily: "var(--head)", fontWeight: 700, fontSize: 17, color: "#0f1b29", lineHeight: 1.3 }}>{p.title}</div>
                    </>
                  )
                  return p.href ? (
                    <a key={i} href={p.href} style={{ textDecoration: "none", color: "inherit" }}>{card}</a>
                  ) : (
                    <div key={i}>{card}</div>
                  )
                })}
              </div>
            </div>
          </section>
        )
      },
    },

    // -----------------------------------------------------------------------
    ContactPanel: {
      label: "Contact panel",
      fields: {
        heading: { type: "text", label: "Section heading" },
        phone: { type: "text", label: "Phone" },
        email: { type: "text", label: "Email" },
        hours: { type: "text", label: "Hours" },
        serviceArea: { type: "text", label: "Service area" },
        note: { type: "textarea", label: "Note" },
      },
      defaultProps: {
        heading: "Contact us",
        phone: "",
        email: "",
        hours: "",
        serviceArea: "",
        note: "",
      },
      render: ({ heading, phone, email, hours, serviceArea, note }: any) => {
        const rows = [
          phone ? { label: "Phone", value: phone } : null,
          email ? { label: "Email", value: email } : null,
          hours ? { label: "Hours", value: hours } : null,
          serviceArea ? { label: "Service area", value: serviceArea } : null,
        ].filter(Boolean) as { label: string; value: string }[]
        return (
          <section style={{ background: "color-mix(in srgb, var(--p) 6%, #fff)" }}>
            <div style={{ ...WRAP, padding: "64px 24px" }}>
              <div className="lh-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "start" }}>
                <div>
                  {heading ? (
                    <h2 className="lh-h2" style={{ ...HEADING, fontSize: 30, fontWeight: 800, color: "var(--p)", margin: "0 0 20px" }}>
                      {heading}
                    </h2>
                  ) : null}
                  {rows.map((r) => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: "1px solid color-mix(in srgb, var(--p) 12%, transparent)", padding: "10px 0" }}>
                      <span style={{ fontSize: 13.5, color: "#5a6675" }}>{r.label}</span>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: "#0f1b29" }}>{r.value}</span>
                    </div>
                  ))}
                  {note ? (
                    <p style={{ marginTop: 16, fontSize: 14.5, lineHeight: 1.6, color: "#5a6675" }}>{note}</p>
                  ) : null}
                </div>
                <div>
                  <LeadForm inline />
                </div>
              </div>
            </div>
          </section>
        )
      },
    },

    // -----------------------------------------------------------------------
    Footer: {
      label: "Footer",
      permissions: { delete: false, drag: false, duplicate: false },
      fields: { text: { type: "text", label: "Text" } },
      defaultProps: { text: "" },
      render: ({ text }: any) => <SiteFooter text={text} />,
    },
  },
}
