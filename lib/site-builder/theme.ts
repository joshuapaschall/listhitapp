import type { CSSProperties } from "react"
import type { SiteTheme } from "./types"

// Map a SiteTheme to the CSS custom properties consumed by the block library.
// Framework-agnostic: the same vars are read by the dashboard editor and the
// public site app, so blocks never depend on Tailwind or globals.css.
export function themeToCssVars(theme: Pick<SiteTheme, "primary" | "accent" | "headingFont">): CSSProperties {
  return {
    ["--p" as any]: theme.primary,
    ["--a" as any]: theme.accent,
    ["--head" as any]: theme.headingFont,
  }
}
