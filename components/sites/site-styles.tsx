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
  .lh-nav { flex-direction: column !important; align-items: center !important; text-align: center !important; gap: 10px !important; }
  .lh-nav-links { flex-wrap: wrap !important; justify-content: center !important; gap: 14px !important; }
  .lh-hero-grid { padding: 92px 20px 60px !important; }
  .lh-hero-photo { min-height: auto !important; }
  .lh-hero-h1 { font-size: clamp(26px, 7.5cqw, 40px) !important; }
  .lh-h2 { font-size: 26px !important; }
  .lh-grid-3 { grid-template-columns: 1fr !important; }
  .lh-form-2 { grid-template-columns: 1fr !important; }
}
`,
      }}
    />
  )
}
