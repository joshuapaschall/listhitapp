import { SiteBeacon } from "@/components/sites/site-beacon"

// Wraps every public tenant page so the analytics beacon fires once per view.
export default function SitesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteBeacon />
    </>
  )
}
