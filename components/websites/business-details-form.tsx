"use client"

import { useEffect, useState } from "react"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useLocationSuggestions } from "@/components/buyers/use-location-suggestions"
import { formatMarketLabel } from "@/lib/site-builder/location-pages"
import { buildConsentTexts } from "@/lib/site-builder/compliance"
import type { SiteBusiness, SiteMarkets } from "@/lib/site-builder/types"

type TrackingConfig = { ga4_id?: string; google_ads_id?: string; google_ads_label?: string; meta_pixel_id?: string }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function BusinessDetailsForm({
  siteId,
  initialName,
  initialBusiness,
  initialMarkets,
  initialTracking,
}: {
  siteId: string
  initialName: string
  initialBusiness: SiteBusiness
  initialMarkets: SiteMarkets
  initialTracking: TrackingConfig
}) {
  const [name, setName] = useState(initialName)
  const [business, setBusinessState] = useState<SiteBusiness>(initialBusiness)
  const [markets, setMarketsState] = useState<SiteMarkets>(initialMarkets)
  const [tracking, setTrackingState] = useState<TrackingConfig>(initialTracking)
  const [marketQuery, setMarketQuery] = useState("")
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const { suggestions: marketSuggestions } = useLocationSuggestions(marketQuery)

  const setBusiness = (patch: Partial<SiteBusiness>) => {
    setBusinessState((b) => ({ ...b, ...patch }))
    setDirty(true)
  }
  const setMarkets = (patch: Partial<SiteMarkets>) => {
    setMarketsState((m) => ({ ...m, ...patch }))
    setDirty(true)
  }
  const setTracking = (patch: Partial<TrackingConfig>) => {
    setTrackingState((t) => ({ ...t, ...patch }))
    setDirty(true)
  }

  // Native "Leave site?" prompt while there are unsaved edits (mirrors the post editor).
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, business, markets, tracking }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Couldn't save changes")
      }
      setDirty(false)
      toast.success("Business details saved")
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save changes")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Business name */}
      <Field label="Business name">
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setDirty(true)
          }}
        />
        <p className="text-xs text-muted-foreground">
          Shows at the top of every page and on your Contact, Terms &amp; Privacy.
        </p>
      </Field>

      {/* Contact */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Contact</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Business email">
            <Input
              type="email"
              placeholder="you@company.com"
              value={business.email}
              onChange={(e) => setBusiness({ email: e.target.value })}
            />
          </Field>
          <Field label="Business phone">
            <Input
              placeholder="(555) 555-5555"
              value={business.phone}
              onChange={(e) => setBusiness({ phone: e.target.value })}
            />
          </Field>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Address</h3>
        <Field label="Street address">
          <Input
            placeholder="123 Main St"
            value={business.address}
            onChange={(e) => setBusiness({ address: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="City">
            <Input value={business.city} onChange={(e) => setBusiness({ city: e.target.value })} />
          </Field>
          <Field label="State">
            <Input
              maxLength={2}
              placeholder="GA"
              value={business.state}
              onChange={(e) => setBusiness({ state: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="ZIP">
            <Input value={business.zip} onChange={(e) => setBusiness({ zip: e.target.value })} />
          </Field>
        </div>
      </div>

      {/* Markets */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Markets</h3>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => setMarkets({ scope: "nationwide" })}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              markets.scope === "nationwide" ? "border-brand bg-brand/5" : "border-border hover:bg-muted/60",
            )}
          >
            <span className="text-sm font-medium">Nationwide</span>
            <p className="mt-0.5 text-xs text-muted-foreground">We work across the U.S.</p>
          </button>
          <button
            type="button"
            onClick={() => setMarkets({ scope: "specific" })}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              markets.scope === "specific" ? "border-brand bg-brand/5" : "border-border hover:bg-muted/60",
            )}
          >
            <span className="text-sm font-medium">Specific markets</span>
            <p className="mt-0.5 text-xs text-muted-foreground">Target specific cities, counties, or states.</p>
          </button>
        </div>

        {markets.scope === "specific" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Add the cities, counties, or states you source and market deals in.
            </p>
            {markets.markets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {markets.markets.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand"
                  >
                    {formatMarketLabel(m)}
                    <button
                      type="button"
                      onClick={() => setMarkets({ markets: markets.markets.filter((x) => x !== m) })}
                      aria-label={`Remove ${formatMarketLabel(m)}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <Input
                placeholder="City, county, or state"
                value={marketQuery}
                onChange={(e) => setMarketQuery(e.target.value)}
                disabled={markets.markets.length >= 25}
              />
              {marketQuery.trim().length > 1 && marketSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-md">
                  {marketSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        if (!markets.markets.includes(s) && markets.markets.length < 25) {
                          setMarkets({ markets: [...markets.markets, s] })
                        }
                        setMarketQuery("")
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Social links */}
      <details className="group">
        <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
          Social links — optional
        </summary>
        <div className="mt-2 space-y-2">
          <Input
            placeholder="Facebook URL"
            value={business.social.facebook || ""}
            onChange={(e) => setBusiness({ social: { ...business.social, facebook: e.target.value } })}
          />
          <Input
            placeholder="Instagram URL"
            value={business.social.instagram || ""}
            onChange={(e) => setBusiness({ social: { ...business.social, instagram: e.target.value } })}
          />
          <Input
            placeholder="YouTube URL"
            value={business.social.youtube || ""}
            onChange={(e) => setBusiness({ social: { ...business.social, youtube: e.target.value } })}
          />
        </div>
      </details>

      {/* Ad tracking */}
      <details className="group">
        <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
          Ad tracking — optional
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">Paste these only if you&apos;re running ads. You can add them later too.</p>
          <Field label="Google Analytics 4 — Measurement ID">
            <Input
              placeholder="G-XXXXXXX"
              value={tracking.ga4_id || ""}
              onChange={(e) => setTracking({ ga4_id: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Google Ads — Conversion ID">
              <Input
                placeholder="AW-XXXXXXXXX"
                value={tracking.google_ads_id || ""}
                onChange={(e) => setTracking({ google_ads_id: e.target.value })}
              />
            </Field>
            <Field label="Google Ads — Conversion label">
              <Input
                placeholder="abcDEF123"
                value={tracking.google_ads_label || ""}
                onChange={(e) => setTracking({ google_ads_label: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Meta Pixel ID">
            <Input
              placeholder="15–16 digit number"
              value={tracking.meta_pixel_id || ""}
              onChange={(e) => setTracking({ meta_pixel_id: e.target.value })}
            />
          </Field>
        </div>
      </details>

      {/* SMS opt-in & consent (read-only) */}
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">SMS opt-in &amp; consent</span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Always on. The exact consent wording is generated from your business name for texting approval and
          can&apos;t be edited.
        </p>
        <div className="mt-3 space-y-2">
          {(() => {
            const consent = buildConsentTexts(name || "your business")
            return [consent.marketing, consent.nonMarketing].map((text, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-background p-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border" />
                <span className="text-xs leading-relaxed text-muted-foreground">{text}</span>
              </div>
            ))
          })()}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="brand" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  )
}
