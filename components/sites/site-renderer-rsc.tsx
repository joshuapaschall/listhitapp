import { Render } from "@measured/puck/rsc"
import { siteConfig } from "@/lib/site-builder/blocks/config"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { SiteStyles } from "@/components/sites/site-styles"
import { interpolateSiteData, cityFromMarkets } from "@/lib/site-builder/interpolate"
import type { SiteTheme } from "@/lib/site-builder/types"

// Public tenant sites render server-side: static blocks become HTML on the server,
// the client islands (LeadForm / DealsSection / SiteFooter) hydrate. The client
// SiteContextProvider wraps the server-rendered tree so those islands can read context.
// The editor preview keeps the client renderer (site-renderer.tsx) — the <Puck> editor
// cannot run in an RSC environment.
export function SiteRendererRSC({ data, theme, form }: { data: any; theme: SiteTheme; form: SiteFormContext }) {
  const typeStyleId = (theme as Partial<SiteTheme>)?.typeStyleId
  const display = interpolateSiteData(data, form?.brandName ?? "our team", cityFromMarkets(form?.markets))
  return (
    <div className="lh-site" style={themeToCssVars(theme)}>
      <SiteStyles />
      <SiteFonts typeStyleId={typeStyleId} />
      <SiteContextProvider value={form}>
        <Render config={siteConfig} data={display} />
      </SiteContextProvider>
    </div>
  )
}
