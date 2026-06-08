"use client"

import { useEffect } from "react"

export interface SiteTracking {
  ga4_id?: string
  google_ads_id?: string
  google_ads_label?: string
  meta_pixel_id?: string
}

declare global {
  interface Window {
    dataLayer?: any[]
    gtag?: (...args: any[]) => void
    fbq?: any
    _fbq?: any
    __lhGtagLoaded?: boolean
    __lhFbqLoaded?: boolean
  }
}

// Injects the SITE OWNER's own ad tags (GA4 / Google Ads / Meta Pixel) on public
// tenant pages, and fires a lead conversion on the "lh:lead" window event. Loads
// nothing when no IDs are configured, and defers to idle so it never blocks
// render or hurts Core Web Vitals. Renders no visible UI.
export function SiteAnalytics({ tracking }: { tracking?: SiteTracking | null }) {
  useEffect(() => {
    const t = tracking || {}
    const ga4 = t.ga4_id?.trim()
    const adsId = t.google_ads_id?.trim()
    const adsLabel = t.google_ads_label?.trim()
    const pixel = t.meta_pixel_id?.trim()

    // No IDs → zero third-party JS.
    if (!ga4 && !adsId && !pixel) return

    let cleanup: (() => void) | undefined

    const run = () => {
      // --- Google (gtag.js) — covers both GA4 and Google Ads ---
      if ((ga4 || adsId) && !window.__lhGtagLoaded) {
        window.__lhGtagLoaded = true
        const primaryId = ga4 || adsId!
        const s = document.createElement("script")
        s.async = true
        s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryId)}`
        document.head.appendChild(s)
        window.dataLayer = window.dataLayer || []
        // eslint-disable-next-line prefer-rest-params
        window.gtag = function gtag() {
          window.dataLayer!.push(arguments)
        }
        window.gtag("js", new Date())
        if (ga4) window.gtag("config", ga4)
        if (adsId) window.gtag("config", adsId)
      }

      // --- Meta Pixel ---
      if (pixel && !window.__lhFbqLoaded) {
        window.__lhFbqLoaded = true
        /* eslint-disable */
        ;(function (f: any, b: Document, e: string, v: string) {
          if (f.fbq) return
          const n: any = (f.fbq = function () {
            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
          })
          if (!f._fbq) f._fbq = n
          n.push = n
          n.loaded = true
          n.version = "2.0"
          n.queue = []
          const t2 = b.createElement(e) as HTMLScriptElement
          t2.async = true
          t2.src = v
          const s0 = b.getElementsByTagName(e)[0]
          s0.parentNode!.insertBefore(t2, s0)
        })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js")
        /* eslint-enable */
        window.fbq("init", pixel)
        window.fbq("track", "PageView")
      }
    }

    const fireLead = () => {
      if (ga4 && window.gtag) window.gtag("event", "generate_lead")
      if (adsId && adsLabel && window.gtag) {
        window.gtag("event", "conversion", { send_to: `${adsId}/${adsLabel}` })
      }
      if (pixel && window.fbq) window.fbq("track", "Lead")
    }

    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined
    let idleHandle: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    if (typeof ric === "function") {
      idleHandle = ric(run, { timeout: 3000 })
    } else {
      timer = setTimeout(run, 1200)
    }

    window.addEventListener("lh:lead", fireLead)
    cleanup = () => {
      window.removeEventListener("lh:lead", fireLead)
      if (idleHandle !== undefined) {
        const cancel = (window as any).cancelIdleCallback as ((h: number) => void) | undefined
        cancel?.(idleHandle)
      }
      if (timer) clearTimeout(timer)
    }

    return cleanup
  }, [tracking])

  return null
}
