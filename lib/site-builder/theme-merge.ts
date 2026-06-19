import type { SiteTheme } from "./types"

// Shallow-clone the stored Puck data and force the Root brand props from the
// resolved theme, so the rendered site reflects the org's brand even if the
// stored page still carries template defaults.
export function mergeThemeIntoRoot(puckData: any, theme: SiteTheme): any {
  const data = { ...(puckData || {}) }
  const root = { ...(data.root || {}) }
  root.props = {
    ...(root.props || {}),
    primary: theme.primary,
    accent: theme.accent,
    headingFont: theme.headingFont,
    bodyFont: theme.bodyFont,   // ADD — so body-font choices actually apply
  }
  data.root = root
  return data
}

// Forces the Nav block's brand identity from the canonical site sources at render
// time, so every page (home and sub-pages rendered from stored Puck data) shows
// the same logo, brand name, and phone — regardless of what was seeded.
// - brandName: only replaces the legacy "Your Company"/empty placeholder.
// - logoUrl:   always set from the site theme (propagates uploads AND removals).
// - phone:     always set from the canonical business phone (like the logo), so that
//              updating the business phone propagates to every page's header.
export function injectNavIdentity(
  puckData: any,
  identity: { brandName?: string; logoUrl?: string | null; phone?: string | null; layout?: string | null },
): any {
  const data = { ...(puckData || {}) }
  const content = Array.isArray(data.content) ? data.content.map((b: any) => ({ ...b })) : []
  for (const block of content) {
    if (block?.type === "Nav") {
      const props = { ...(block.props || {}) }

      const curBrand = (props.brandName || "").trim()
      if (
        identity.brandName &&
        identity.brandName.trim() &&
        identity.brandName !== "our team" &&
        (!curBrand || curBrand === "Your Company")
      ) {
        props.brandName = identity.brandName
      }

      if (identity.logoUrl !== undefined) {
        props.logoUrl = identity.logoUrl || ""
      }

      if (identity.layout !== undefined && identity.layout !== null) {
        props.layout = identity.layout
      }

      if (identity.phone && identity.phone.trim()) {
        props.phone = identity.phone
      }

      block.props = props
    }
  }
  data.content = content
  return data
}
