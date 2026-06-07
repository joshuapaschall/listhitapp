"use client"
import { createContext, useContext } from "react"
import type { SitePersona, SiteMarkets, DealSummary } from "./types"

export interface SiteFormContext {
  persona: SitePersona
  brandName: string
  optinEnabled: boolean
  requireConsent: boolean
  disclosure: string   // exact opt-in text shown + stored as consent_text
  legalPaths: { terms: string; privacy: string }
  markets: SiteMarkets
  deals: DealSummary[]
}

const DEFAULT_FORM_CONTEXT: SiteFormContext = {
  persona: "cash",
  brandName: "our team",
  optinEnabled: true,
  requireConsent: true,
  disclosure: "",
  legalPaths: { terms: "/terms", privacy: "/privacy" },
  markets: { scope: "nationwide", markets: [] },
  deals: [],
}

const Ctx = createContext<SiteFormContext>(DEFAULT_FORM_CONTEXT)
export function SiteContextProvider({ value, children }: { value: SiteFormContext; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useSiteForm(): SiteFormContext {
  return useContext(Ctx)
}
