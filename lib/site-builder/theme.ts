import type { CSSProperties } from "react"
import type { SiteTheme } from "./types"

// Map a SiteTheme to the CSS custom properties consumed by the block library.
// --p (primary), --a (accent), --head (heading font), --body (body font).
export function themeToCssVars(
  theme: Pick<SiteTheme, "primary" | "accent" | "headingFont" | "bodyFont">,
): CSSProperties {
  return {
    ["--p" as any]: theme.primary,
    ["--a" as any]: theme.accent,
    ["--head" as any]: theme.headingFont,
    ["--body" as any]: theme.bodyFont || "'Hanken Grotesk', sans-serif",
  }
}
