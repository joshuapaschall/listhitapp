"use client"
import { Render } from "@measured/puck"
import { siteConfig } from "@/lib/site-builder/blocks/config"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { SiteStyles } from "@/components/sites/site-styles"
import type { SiteTheme } from "@/lib/site-builder/types"

export function SiteRenderer({ data, theme, form }: { data: any; theme: SiteTheme; form?: SiteFormContext }) {
  // Older rows may lack typeStyleId; the font loader falls back to
  // the default pairing rather than throwing.
  const typeStyleId = (theme as Partial<SiteTheme>)?.typeStyleId
  const rendered = <Render config={siteConfig} data={data} />
  return (
    <div className="lh-site" style={themeToCssVars(theme)}>
      <SiteStyles />
      <SiteFonts typeStyleId={typeStyleId} />
      {form ? <SiteContextProvider value={form}>{rendered}</SiteContextProvider> : rendered}
    </div>
  )
}
