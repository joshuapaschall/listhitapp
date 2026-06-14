import { Render } from "@measured/puck/rsc"
import { siteConfig } from "@/lib/site-builder/blocks/config"
import { themeToCssVars } from "@/lib/site-builder/theme"
import { SiteFonts } from "@/components/sites/site-fonts"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { SiteStyles } from "@/components/sites/site-styles"
import { interpolateSiteData, cityFromMarkets } from "@/lib/site-builder/interpolate"
import { injectNavIdentity } from "@/lib/site-builder/resolve-site"
import type { SiteTheme } from "@/lib/site-builder/types"

// Public tenant sites render server-side: static blocks become HTML on the server,
// the client islands (LeadForm / DealsSection / SiteFooter) hydrate. The client
// SiteContextProvider wraps the server-rendered tree so those islands can read context.
// The editor preview keeps the client renderer (site-renderer.tsx) — the <Puck> editor
// cannot run in an RSC environment.
export function SiteRendererRSC({
  data,
  theme,
  form,
  cityOverride,
}: {
  data: any
  theme: SiteTheme
  form: SiteFormContext
  cityOverride?: string
}) {
  const typeStyleId = (theme as Partial<SiteTheme>)?.typeStyleId
  // Location pages force {City} to the page's market; home callers pass nothing
  // and fall back to the market-derived city exactly as before.
  const city = cityOverride ?? cityFromMarkets(form?.markets)
  let display = interpolateSiteData(data, form?.brandName ?? "our team", city)
  display = injectNavIdentity(display, {
    brandName: form?.brandName,
    logoUrl: (theme as any)?.logoUrl,
    phone: (form as any)?.business?.phone,
  })
  const layout = (data as any)?.root?.props?.layout
  return (
    <div className={`lh-site${layout ? ` lh-lay-${layout}` : ""}`} style={themeToCssVars(theme)}>
      <SiteStyles />
      <SiteFonts typeStyleId={typeStyleId} />
      <SiteContextProvider value={form}>
        <main>
          <Render config={siteConfig} data={display} />
        </main>
      </SiteContextProvider>
    </div>
  )
}
