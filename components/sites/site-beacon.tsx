"use client"
import { useEffect } from "react"
import { usePathname } from "next/navigation"

// Module-level guard: send at most one pageview per path per page load, so
// re-renders / fast-refresh don't double-count.
const sent = new Set<string>()

const VID_COOKIE = "lh_vid"
const TWO_YEARS = 60 * 60 * 24 * 730

function readOrCreateVisitorId(): string {
  const match = document.cookie.match(/(?:^|;\s*)lh_vid=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  // First-party, non-PII random id for unique-visitor counting only.
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
  document.cookie = `${VID_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${TWO_YEARS}; SameSite=Lax`
  return id
}

// Fire-and-forget pageview beacon for published tenant sites. Deferred to idle
// so it never blocks render or hurts Core Web Vitals. No browser storage beyond
// the first-party lh_vid cookie.
export function SiteBeacon() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || sent.has(pathname)) return

    const fire = () => {
      if (sent.has(pathname)) return
      sent.add(pathname)
      try {
        const params = new URLSearchParams(window.location.search)
        const body = {
          path: window.location.pathname,
          referrer: document.referrer || undefined,
          utm_source: params.get("utm_source") || undefined,
          utm_medium: params.get("utm_medium") || undefined,
          utm_campaign: params.get("utm_campaign") || undefined,
          visitor_id: readOrCreateVisitorId(),
        }
        void fetch("/api/public/site-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
          credentials: "omit",
        }).catch(() => {})
      } catch {
        /* never throw from the beacon */
      }
    }

    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined
    if (typeof ric === "function") {
      const handle = ric(fire, { timeout: 2000 })
      return () => {
        const cancel = (window as any).cancelIdleCallback as ((h: number) => void) | undefined
        cancel?.(handle)
      }
    }
    const t = setTimeout(fire, 800)
    return () => clearTimeout(t)
  }, [pathname])

  return null
}
