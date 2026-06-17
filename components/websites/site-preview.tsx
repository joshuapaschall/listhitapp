"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Monitor, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SiteRenderer } from "@/components/sites/site-renderer"
import { composePreview, type WizardContent } from "@/lib/site-builder/compose"
import { buildSiteNavLinks } from "@/lib/site-builder/nav-links"
import {
  PREVIEW_PAGES,
  normalizePreviewPath,
  buildPreviewPuck,
  buildPreviewLegalDoc,
} from "@/lib/site-builder/preview-pages"
import { PropertiesPage } from "@/components/sites/properties-page"
import { BlogIndexPage } from "@/components/sites/blog-index-page"
import { LegalPage } from "@/components/sites/legal-page"
import { BuyerProfilePage } from "@/components/sites/buyer-profile-page"
import { SiteFonts } from "@/components/sites/site-fonts"
import { buildConsentTexts } from "@/lib/site-builder/compliance"
import type { SiteFormContext } from "@/lib/site-builder/site-context"
import type { SitePersona, SiteTemplateId, SiteTheme, SiteBusiness, SiteMarkets } from "@/lib/site-builder/types"

interface SitePreviewProps {
  templateId: SiteTemplateId
  persona: SitePersona
  theme: SiteTheme
  content: Partial<WizardContent>
  business: SiteBusiness
  markets: SiteMarkets
  navPages: { path: string; navLabel: string }[]
}

export function SitePreview({ templateId, persona, theme, content, business, markets, navPages }: SitePreviewProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const [previewPath, setPreviewPath] = useState("/")
  const scrollRef = useRef<HTMLDivElement>(null)

  const effectiveContent = useMemo(
    () => ({
      ...content,
      phone: business.phone?.trim() ? business.phone : (content.phone || ""),
    }),
    [content, business],
  )

  const composedHome = useMemo(
    () => composePreview(templateId, persona, theme, effectiveContent, navPages),
    [templateId, persona, theme, effectiveContent, navPages],
  )

  // Build the same form context the published site uses, so the preview shows
  // the opt-in disclosure + consent checkbox accurately.
  const form = useMemo<SiteFormContext>(() => {
    const brandName = content.brandName || "your team"
    const consent = buildConsentTexts(brandName)
    const navLinks = buildSiteNavLinks({
      hasPosts: false,
      enabledPages: (navPages || []).map((p, i) => ({ path: p.path, nav_label: p.navLabel, sort_order: i })),
    })
    return {
      persona,
      brandName,
      // Opt-in is always on; the two consent checkboxes always render.
      optinEnabled: true,
      requireConsent: true,
      disclosure: consent.marketing,
      consentMarketing: consent.marketing,
      consentNonMarketing: consent.nonMarketing,
      // Real paths so legal links resolve to previewable pages (clicks are
      // intercepted below and routed in-preview, not to the dashboard).
      legalPaths: { terms: "/terms", privacy: "/privacy" },
      markets,
      deals: [],
      business,
      navLinks,
    }
  }, [persona, content.brandName, business, markets, navPages])

  // Intercept internal link clicks and route them within the preview instead of
  // navigating the dashboard. External/phone/mail/new-tab clicks behave normally.
  const onPreviewClick = useCallback((e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest("a")
    if (!anchor) return
    const href = anchor.getAttribute("href") || ""
    if (!href.startsWith("/") || href.startsWith("//")) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || (anchor.getAttribute("target") || "") === "_blank") return
    e.preventDefault()
    setPreviewPath(normalizePreviewPath(href))
  }, [])

  // Scroll the preview frame back to top whenever the page changes.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [previewPath])

  const pageNode = useMemo(() => {
    const puck = buildPreviewPuck(previewPath, composedHome, persona, business, markets)
    if (puck) {
      return <SiteRenderer data={puck} theme={theme} form={form} />
    }
    const brandName = form.brandName
    switch (previewPath) {
      case "/properties":
        return (
          <PropertiesPage
            brandName={brandName}
            theme={theme}
            business={business}
            formContext={form}
            publicMode
            unlocked
            deals={[]}
            count={0}
            navLinks={form.navLinks || []}
          />
        )
      case "/blog":
        return (
          <BlogIndexPage
            host=""
            site={{}}
            theme={theme}
            business={business}
            formContext={form}
            posts={[]}
            navLinks={form.navLinks || []}
          />
        )
      case "/privacy":
      case "/terms":
        return (
          <LegalPage
            doc={buildPreviewLegalDoc(previewPath === "/privacy" ? "privacy" : "terms", brandName, business)}
            brandName={brandName}
            phone={business.phone}
            theme={theme}
            business={business}
            navLinks={form.navLinks || []}
            formContext={form}
          />
        )
      case "/get-on-the-list":
        return (
          <BuyerProfilePage
            persona={persona}
            brandName={brandName}
            theme={theme}
            consentText={form.consentMarketing || form.disclosure}
          />
        )
      default:
        return <SiteRenderer data={composedHome} theme={theme} form={form} />
    }
  }, [previewPath, composedHome, persona, business, markets, theme, form])

  return (
    <div className="flex h-full flex-col">
      <SiteFonts typeStyleId={theme.typeStyleId} />
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Live preview</span>
          <select
            value={previewPath}
            onChange={(e) => setPreviewPath(e.target.value)}
            aria-label="Preview page"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground"
          >
            {PREVIEW_PAGES.map((p) => (
              <option key={p.path} value={p.path}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={device === "desktop" ? "secondary" : "ghost"}
            className="h-8 gap-1.5"
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === "mobile" ? "secondary" : "ghost"}
            className="h-8 gap-1.5"
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto bg-muted p-4" onClick={onPreviewClick}>
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-xl border border-border bg-background shadow-sm",
            device === "mobile" ? "w-[390px] max-w-full" : "w-full",
          )}
        >
          {pageNode}
        </div>
      </div>
    </div>
  )
}
