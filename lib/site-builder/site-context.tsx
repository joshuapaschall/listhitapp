"use client"
import { createContext, useContext } from "react"
import type { SitePersona, SiteMarkets, DealSummary, SiteBusiness } from "./types"
import { DEFAULT_BUSINESS } from "./types"

export interface SiteFormContext {
  siteId?: string   // set by the studio editor so custom fields (image upload) can sign uploads
  persona: SitePersona
  brandName: string
  optinEnabled: boolean
  requireConsent: boolean
  disclosure: string   // exact opt-in text shown + stored as consent_text
  consentMarketing?: string     // marketing checkbox label (fixed system wording)
  consentNonMarketing?: string  // non-marketing checkbox label (fixed system wording)
  legalDisplay?: string         // "Legal Name DBA Brand" for the footer, when they differ
  legalPaths: { terms: string; privacy: string }
  markets: SiteMarkets
  deals: DealSummary[]
  business: SiteBusiness
  navLinks?: { label: string; href: string }[]
}

const DEFAULT_FORM_CONTEXT: SiteFormContext = {
  siteId: "",
  persona: "cash",
  brandName: "our team",
  optinEnabled: true,
  requireConsent: true,
  disclosure: "",
  consentMarketing: "",
  consentNonMarketing: "",
  legalPaths: { terms: "/terms", privacy: "/privacy" },
  markets: { scope: "nationwide", markets: [] },
  deals: [],
  business: DEFAULT_BUSINESS,
  navLinks: [],
}

const Ctx = createContext<SiteFormContext>(DEFAULT_FORM_CONTEXT)
export function SiteContextProvider({ value, children }: { value: SiteFormContext; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useSiteForm(): SiteFormContext {
  return useContext(Ctx)
}
