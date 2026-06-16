import type { CSSProperties } from "react"
import type { SiteTheme } from "./types"
import { readableTextOn, readableAccentText } from "./contrast"

// Map a SiteTheme to the CSS custom properties consumed by the block library.
// --p (primary), --a (accent), --head (heading font), --body (body font).
// --p-ink / --a-ink are readable text colors for content sitting on those bgs.
export function themeToCssVars(
  theme: Pick<SiteTheme, "primary" | "accent" | "headingFont" | "bodyFont">,
): CSSProperties {
  return {
    ["--p" as any]: theme.primary,
    ["--a" as any]: theme.accent,
    ["--p-ink" as any]: readableTextOn(theme.primary),
    ["--a-ink" as any]: readableTextOn(theme.accent),
    ["--a-ink-light" as any]: readableAccentText(theme.accent),
    ["--head" as any]: theme.headingFont,
    ["--body" as any]: theme.bodyFont || "'Hanken Grotesk', sans-serif",
  }
}
