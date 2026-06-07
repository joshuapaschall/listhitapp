"use client"
import { Render } from "@measured/puck"
import { siteConfig } from "@/lib/site-builder/blocks/config"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { googleFontsHref } from "@/lib/site-builder/typography"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import type { SiteTheme } from "@/lib/site-builder/types"

export function SiteRenderer({ data, theme, form }: { data: any; theme: SiteTheme; form?: SiteFormContext }) {
  // Older rows may lack typeStyleId; googleFontsHref(undefined) falls back to
  // the default pairing rather than throwing.
  const typeStyleId = (theme as Partial<SiteTheme>)?.typeStyleId
  const rendered = <Render config={siteConfig} data={data} />
  return (
    <div style={themeToCssVars(theme)}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(typeStyleId)} />
      {form ? <SiteContextProvider value={form}>{rendered}</SiteContextProvider> : rendered}
    </div>
  )
}
