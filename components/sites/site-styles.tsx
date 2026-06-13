import type React from "react"

/**
 * Single source of responsive behavior for published tenant sites AND the wizard
 * preview. We use CSS *container* queries (not @media) keyed off
 * `.lh-site { container-type: inline-size }`, so the rules evaluate against the
 * site's own rendered width — which is the viewport on a live site, and the
 * constrained preview box (e.g. the 390px "Mobile" frame) in the wizard. That
 * makes the preview faithful without an iframe.
 *
 * `!important` is required: these rules must override the inline desktop `style`
 * props the Puck blocks set. Font sizes use `cqw` (container width) units so type
 * scales to the container, not the viewport.
 */
export function SiteStyles(): React.JSX.Element {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
.lh-site { container-type: inline-size; }
.lh-site img { max-width: 100%; }
.lh-site h1, .lh-site h2, .lh-hero-h1, .lh-h2 { text-wrap: balance; }
.lh-site p { text-wrap: pretty; }

/* Mobile nav: burger button + drawer (hidden on desktop; shown via the 768 query). */
.lh-nav-burger { display: none; align-items: center; justify-content: center; width: 40px; height: 40px; border: none; background: transparent; cursor: pointer; padding: 0; }
.lh-nav-drawer { display: none; }
.lh-nav-drawer[data-open="true"] { display: block; position: absolute; left: 0; right: 0; top: 100%; background: #fff; border-bottom: 1px solid #eef1f5; box-shadow: 0 18px 40px rgba(5,12,24,.12); z-index: 40; }

/* tablet: 3-up grids become 2-up */
@container (max-width: 1024px) {
  .lh-grid-3 { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
}

/* large phone / small tablet: two-column heroes stack */
@container (max-width: 900px) {
  .lh-hero-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
  .lh-grid-2 { grid-template-columns: 1fr !important; gap: 28px !important; }
}

/* phones */
@container (max-width: 768px) {
  .lh-nav { flex-direction: row !important; align-items: center !important; justify-content: space-between !important; text-align: left !important; gap: 12px !important; }
  .lh-nav-links { display: none !important; }
  .lh-nav-burger { display: inline-flex !important; }
  .lh-hero-grid { padding: 92px 20px 60px !important; }
  .lh-hero-photo { min-height: auto !important; }
  .lh-hero-h1 { font-size: clamp(26px, 7.5cqw, 40px) !important; }
  .lh-h2 { font-size: 26px !important; }
  .lh-grid-3 { grid-template-columns: 1fr !important; }
  .lh-form-2 { grid-template-columns: 1fr !important; }
  .lh-hero-trust { display: none !important; }
  .lh-hero-sub { display: none !important; }
  .lh-hero-eyebrow { margin-bottom: 12px !important; }
  .lh-hero-grid { padding-top: 28px !important; }
}

/* ---- Per-template layout treatments (brand-agnostic). Marquee = base. ---- */
/* HAVEN — editorial: centered headings, airy sections */
.lh-lay-haven .lh-h2 { text-align: center !important; margin-left: auto !important; margin-right: auto !important; }
.lh-lay-haven .lh-sec { padding-top: 82px !important; padding-bottom: 82px !important; }
/* VANTAGE — conversion: left headings with an accent bar, denser sections */
.lh-lay-vantage .lh-h2 { text-align: left !important; margin-left: 0 !important; margin-right: 0 !important; border-left: 4px solid var(--a); padding-left: 14px; }
.lh-lay-vantage .lh-sec { padding-top: 50px !important; padding-bottom: 50px !important; }
/* FORGE — bold: heavy uppercase headers */
.lh-lay-forge .lh-h2 { text-transform: uppercase; font-weight: 900 !important; letter-spacing: -0.01em; }
.lh-lay-forge .lh-sec { padding-top: 58px !important; padding-bottom: 58px !important; }

/* Prose subheads (ProseSection bodyHtml injects <h3>/<p> into .lh-prose) */
.lh-site .lh-prose h3 { font-family: var(--head); font-weight: 800; font-size: 18px; line-height: 1.25; letter-spacing: -.005em; color: var(--p); margin: 22px 0 8px; }
.lh-site .lh-prose p { margin: 0 0 12px; }
`,
      }}
    />
  )
}
