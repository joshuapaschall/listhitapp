"use client"
import { Render } from "@measured/puck"
import { siteConfig } from "@/lib/site-builder/blocks/config"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { interpolateSiteData, cityFromMarkets } from "@/lib/site-builder/interpolate"
// Client-safe mirror — importing resolve-site here would pull the server-only
// Supabase admin client into the browser bundle (crashes the wizard preview).
import { injectBrandName } from "@/lib/site-builder/compose"
import type { SiteTheme } from "@/lib/site-builder/types"

export function SiteRenderer({ data, theme, form }: { data: any; theme: SiteTheme; form?: SiteFormContext }) {
  // Older rows may lack typeStyleId; the font loader falls back to
  // the default pairing rather than throwing.
  const typeStyleId = (theme as Partial<SiteTheme>)?.typeStyleId
  let display = interpolateSiteData(data, form?.brandName ?? "our team", cityFromMarkets(form?.markets))
  display = injectBrandName(display, form?.brandName)
  const layout = (data as any)?.root?.props?.layout
  const rendered = (
    <main>
      <Render config={siteConfig} data={display} />
    </main>
  )
  return (
    <div className={`lh-site${layout ? ` lh-lay-${layout}` : ""}`} style={themeToCssVars(theme)}>
      <SiteFonts typeStyleId={typeStyleId} />
      {form ? <SiteContextProvider value={form}>{rendered}</SiteContextProvider> : rendered}
    </div>
  )
}
