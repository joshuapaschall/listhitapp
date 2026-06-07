"use client"
import { Render } from "@measured/puck"
import { siteConfig } from "@/lib/site-builder/blocks/config"
import { themeToCssVars } from "@/lib/site-builder/theme"
import type { SiteTheme } from "@/lib/site-builder/types"

export function SiteRenderer({ data, theme }: { data: any; theme: SiteTheme }) {
  return (
    <div style={themeToCssVars(theme)}>
      <Render config={siteConfig} data={data} />
    </div>
  )
}
