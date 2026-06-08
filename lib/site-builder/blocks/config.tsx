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
      primary: { type: "text" },
      accent: { type: "text" },
      headingFont: { type: "text" },
      bodyFont: { type: "text" },
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
      fields: {
        brandName: { type: "text" },
        logoUrl: { type: "text" },
        phone: { type: "text" },
        links: { type: "array", arrayFields: { label: { type: "text" }, href: { type: "text" } } },
        layout: {
          type: "select",
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
      fields: {
        variant: {
          type: "select",
          options: [
            { label: "Photo", value: "photo" },
            { label: "Centered", value: "centered" },
            { label: "Split", value: "split" },
            { label: "Band", value: "band" },
          ],
        },
        eyebrow: { type: "text" },
        headline: { type: "textarea" },
        subhead: { type: "textarea" },
        stat: { type: "text" },
        imageUrl: { type: "text" },
        formTitle: { type: "text" },
        formSubtitle: { type: "text" },
        ctaLabel: { type: "text" },
      },
      defaultProps: {
        variant: "photo",
        eyebrow: "Off-market deals",
        headline: "Get first access to deeply discounted properties.",
        subhead: "Join the buyers list and we'll send wholesale-priced, off-market deals straight to your phone — before anyone else sees them.",
        stat: "Trusted by 2,400+ cash buyers",
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

        const h = (color: string) => (
          <h1 className="lh-hero-h1" style={{ ...HEADING, fontSize: 44, fontWeight: 800, color, margin: 0 }}>{headline}</h1>
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
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 28 }}>
              <div style={{ display: "flex" }}>
                {["JD", "MK", "RP", "+"].map((t, i) => (
                  <span
                    key={i}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      border: "2px solid #0c1420",
                      marginLeft: i === 0 ? 0 : -10,
                      background: "#3a4a5e",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#dfe7f0",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div>
                <div style={{ color: "#ffb733", letterSpacing: 2, fontSize: 15 }}>★★★★★</div>
                <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.72)", marginTop: 2 }}>{stat}</div>
              </div>
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
            <section style={{ background: "color-mix(in srgb, var(--p) 7%, #fff)" }}>
              <div style={{ ...WRAP, padding: "72px 24px", textAlign: "center" }}>
                {eyebrowEl}
                <h1 className="lh-hero-h1" style={{ ...HEADING, fontSize: 46, fontWeight: 800, color: "var(--p)", margin: "0 auto", maxWidth: 760 }}>
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
            <section style={{ background: "#fff" }}>
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
                      ★ {stat}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        }

        // band
        return (
          <section>
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
                  {h("#fff")}
                  {sub("rgba(255,255,255,.86)")}
                  {stat && <div style={{ marginTop: 16, color: "#fff", fontWeight: 700 }}>★ {stat}</div>}
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
          arrayFields: {
            value: { type: "text" },
            label: { type: "text" },
          },
          getItemSummary: (item: any) =>
            [item?.value, item?.label].filter(Boolean).join(" — ") || "Stat",
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
        heading: { type: "text" },
        features: {
          type: "array",
          arrayFields: {
            icon: { type: "text" },
            title: { type: "text" },
            body: { type: "textarea" },
          },
        },
      },
      defaultProps: {
        heading: "Why homeowners choose us",
        features: [
          { icon: "⚡", title: "Close fast", body: "Pick your closing date — as quick as 7 days." },
          { icon: "💵", title: "Fair cash offer", body: "No lowballs. A real number you can count on." },
          { icon: "🛠️", title: "Sell as-is", body: "No repairs, no cleaning, no showings." },
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
    PropertyGrid: {
      label: "Property grid",
      fields: {
        heading: { type: "text" },
      },
      defaultProps: { heading: "Recent deals" },
      render: ({ heading }: any) => <DealsSection heading={heading} />,
    },

    // -----------------------------------------------------------------------
    CtaBand: {
      label: "CTA band",
      fields: {
        heading: { type: "text" },
        body: { type: "textarea" },
        buttonLabel: { type: "text" },
      },
      defaultProps: {
        heading: "Ready for your offer?",
        body: "Tell us about your property and get a fair cash offer today.",
        buttonLabel: "Get my cash offer",
      },
      render: ({ heading, body, buttonLabel }: any) => (
        <section style={{ background: "var(--p)" }}>
          <div style={{ ...WRAP, padding: "56px 24px", textAlign: "center" }}>
            <h2 className="lh-h2" style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "#fff", margin: 0 }}>{heading}</h2>
            {body && <p style={{ color: "rgba(255,255,255,.85)", fontSize: 17, marginTop: 12, maxWidth: 560, marginInline: "auto" }}>{body}</p>}
            <button
              type="button"
              style={{
                marginTop: 22,
                padding: "14px 28px",
                borderRadius: 10,
                border: "none",
                background: "var(--a)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              {buttonLabel}
            </button>
          </div>
        </section>
      ),
    },

    // -----------------------------------------------------------------------
    Footer: {
      label: "Footer",
      fields: { text: { type: "text" } },
      defaultProps: { text: "" },
      render: ({ text }: any) => <SiteFooter text={text} />,
    },
  },
}
