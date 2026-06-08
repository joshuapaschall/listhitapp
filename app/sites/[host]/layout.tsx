import { SiteBeacon } from "@/components/sites/site-beacon"
import { SiteAnalytics } from "@/components/sites/site-analytics"
import { resolveSiteByHost } from "@/lib/site-builder/resolve-site"

// Wraps every public tenant page: the first-party analytics beacon plus the
// site owner's own ad tags (only loaded when they've configured IDs).
export default async function SitesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { host: string }
}) {
  const host = decodeURIComponent(params.host)
  const site = await resolveSiteByHost(host).catch(() => null)
  return (
    <>
      {children}
      <SiteBeacon />
      <SiteAnalytics tracking={(site?.tracking_json as any) ?? null} />
    </>
  )
}
