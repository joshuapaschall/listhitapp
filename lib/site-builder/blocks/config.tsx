import React from "react"
import type { Config } from "@measured/puck"
import { themeToCssVars } from "../theme"

// ---------------------------------------------------------------------------
// Shared primitives — every block is self-contained and token-driven. Styling
// reads the CSS variables --p (primary), --a (accent), --head (heading font)
// that Root sets, so this config renders identically in the dashboard editor
// and in the standalone public site app. No Tailwind, no globals.css.
// ---------------------------------------------------------------------------

const WRAP: React.CSSProperties = { maxWidth: 1120, margin: "0 auto", padding: "0 24px" }

// A self-contained lead capture form. Kept above the fold in every hero variant.
function LeadForm({
  title,
  subtitle,
  ctaLabel,
  inline,
}: {
  title?: string
  subtitle?: string
  ctaLabel?: string
  inline?: boolean
}) {
  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #d7dde4",
    fontSize: 15,
    outline: "none",
    background: "#fff",
    color: "#0f1b29",
  }
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 18px 40px rgba(16,27,41,.16)",
        border: "1px solid #eef1f5",
        padding: 20,
        width: "100%",
        maxWidth: inline ? "none" : 380,
      }}
    >
      {title && (
        <div style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 19, color: "#0f1b29" }}>{title}</div>
      )}
      {subtitle && <div style={{ fontSize: 13.5, color: "#5a6675", marginTop: 4 }}>{subtitle}</div>}
      <div
        style={{
          display: inline ? "grid" : "block",
          gridTemplateColumns: inline ? "1fr 1fr" : undefined,
          gap: 10,
          marginTop: 14,
        }}
      >
        <input style={fieldStyle} placeholder="Full name" aria-label="Full name" />
        <input style={fieldStyle} placeholder="Phone" aria-label="Phone" />
        <input style={{ ...fieldStyle, gridColumn: inline ? "1 / -1" : undefined }} placeholder="Property address" aria-label="Property address" />
      </div>
      <button
        type="button"
        style={{
          marginTop: 12,
          width: "100%",
          padding: "13px 16px",
          borderRadius: 10,
          border: "none",
          background: "var(--a)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15.5,
          cursor: "pointer",
        }}
      >
        {ctaLabel || "Get my offer"}
      </button>
      <div style={{ fontSize: 11.5, color: "#8a94a2", marginTop: 9, textAlign: "center" }}>
        No spam. No obligation. 100% free.
      </div>
    </div>
  )
}

const HEADING: React.CSSProperties = { fontFamily: "var(--head)", lineHeight: 1.05, letterSpacing: "-.01em" }

export const siteConfig: Config = {
  root: {
    fields: {
      primary: { type: "text" },
      accent: { type: "text" },
      headingFont: { type: "text" },
    },
    defaultProps: {
      primary: "#173b5e",
      accent: "#e8833a",
      headingFont: "'Bricolage Grotesque', serif",
    },
    render: ({ primary, accent, headingFont, children }: any) => (
      <div
        style={{
          ...themeToCssVars({
            primary: primary || "#173b5e",
            accent: accent || "#e8833a",
            headingFont: headingFont || "'Bricolage Grotesque', serif",
          }),
          fontFamily: "'Hanken Grotesk', sans-serif",
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
        links: { type: "array", arrayFields: { label: { type: "text" } } },
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
        links: [{ label: "How it works" }, { label: "Reviews" }, { label: "Contact" }],
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
          <nav style={{ display: "flex", gap: 22, alignItems: "center" }}>
            {(links || []).map((l: any, i: number) => (
              <a key={i} href="#" style={{ color: "#3a4554", textDecoration: "none", fontSize: 14.5 }}>
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
        eyebrow: "Trusted local buyer",
        headline: "Sell your house fast — for cash",
        subhead: "Get a fair, no-obligation cash offer in 24 hours.",
        stat: "500+ homes purchased",
        imageUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600",
        formTitle: "Get your cash offer",
        formSubtitle: "Takes 60 seconds.",
        ctaLabel: "Get my offer",
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
          <h1 style={{ ...HEADING, fontSize: 44, fontWeight: 800, color, margin: 0 }}>{headline}</h1>
        )
        const sub = (color: string) => (
          <p style={{ fontSize: 18, lineHeight: 1.5, color, marginTop: 14, maxWidth: 520 }}>{subhead}</p>
        )

        if (variant === "photo") {
          return (
            <section
              style={{
                backgroundImage: `linear-gradient(90deg, rgba(11,22,36,.78), rgba(11,22,36,.35)), url(${imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div
                style={{
                  ...WRAP,
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) minmax(280px,400px)",
                  gap: 40,
                  alignItems: "center",
                  padding: "76px 24px",
                }}
              >
                <div>
                  {eyebrowEl}
                  {h("#fff")}
                  {sub("rgba(255,255,255,.88)")}
                  {stat && <div style={{ marginTop: 18, color: "#fff", fontWeight: 700 }}>★ {stat}</div>}
                </div>
                <LeadForm title={formTitle} subtitle={formSubtitle} ctaLabel={ctaLabel} />
              </div>
            </section>
          )
        }

        if (variant === "centered") {
          return (
            <section style={{ background: "color-mix(in srgb, var(--p) 7%, #fff)" }}>
              <div style={{ ...WRAP, padding: "72px 24px", textAlign: "center" }}>
                {eyebrowEl}
                <h1 style={{ ...HEADING, fontSize: 46, fontWeight: 800, color: "var(--p)", margin: "0 auto", maxWidth: 760 }}>
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
                    src={imageUrl}
                    alt=""
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
      label: "Trust bar",
      fields: {
        items: { type: "array", arrayFields: { label: { type: "text" } } },
      },
      defaultProps: {
        items: [{ label: "A+ BBB rated" }, { label: "Cash in 7 days" }, { label: "No fees, no commissions" }, { label: "500+ 5-star reviews" }],
      },
      render: ({ items }: any) => (
        <div style={{ background: "var(--p)" }}>
          <div
            style={{
              ...WRAP,
              display: "flex",
              flexWrap: "wrap",
              gap: 28,
              justifyContent: "center",
              padding: "16px 24px",
            }}
          >
            {(items || []).map((it: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 14.5, fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--a)" }} />
                {it?.label}
              </div>
            ))}
          </div>
        </div>
      ),
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
              <h2 style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", textAlign: "center", margin: "0 0 36px" }}>
                {heading}
              </h2>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
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
      render: ({ heading }: any) => {
        const samples = [
          { city: "Atlanta, GA", price: "$185,000", beds: "3 bd · 2 ba · 1,540 sqft" },
          { city: "Decatur, GA", price: "$142,500", beds: "2 bd · 1 ba · 1,080 sqft" },
          { city: "Marietta, GA", price: "$229,900", beds: "4 bd · 3 ba · 2,210 sqft" },
        ]
        return (
          <section style={{ background: "color-mix(in srgb, var(--p) 5%, #fff)" }}>
            <div style={{ ...WRAP, padding: "64px 24px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 10 }}>
                <h2 style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "var(--p)", margin: 0 }}>{heading}</h2>
                <span style={{ fontSize: 12.5, color: "#8a94a2", fontWeight: 600 }}>Pulled live from your pipeline</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 22 }}>
                {samples.map((s, i) => (
                  <div key={i} style={{ border: "1px solid #eef1f5", borderRadius: 16, overflow: "hidden", background: "#fff", boxShadow: "0 8px 24px rgba(16,27,41,.05)" }}>
                    <div style={{ height: 150, background: "linear-gradient(135deg, color-mix(in srgb, var(--p) 22%, #fff), color-mix(in srgb, var(--a) 22%, #fff))" }} />
                    <div style={{ padding: 16 }}>
                      <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 20, color: "var(--p)" }}>{s.price}</div>
                      <div style={{ color: "#0f1b29", fontWeight: 600, marginTop: 2 }}>{s.city}</div>
                      <div style={{ color: "#5a6675", fontSize: 13.5, marginTop: 4 }}>{s.beds}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      },
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
            <h2 style={{ ...HEADING, fontSize: 32, fontWeight: 800, color: "#fff", margin: 0 }}>{heading}</h2>
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
      defaultProps: { text: "© Your Company. All rights reserved." },
      render: ({ text }: any) => (
        <footer style={{ borderTop: "1px solid #eef1f5", background: "#fff" }}>
          <div style={{ ...WRAP, padding: "28px 24px", color: "#8a94a2", fontSize: 13.5, textAlign: "center" }}>{text}</div>
        </footer>
      ),
    },
  },
}
