import type { SiteMarkets } from "@/lib/site-builder/types"
import { cityLabelForMarket } from "@/lib/site-builder/location-pages"

// "Atlanta (GA)" -> "Atlanta", "GA, USA" -> "Georgia". Nationwide or empty -> "your area".
export function cityFromMarkets(markets?: SiteMarkets | null): string {
  if (!markets || markets.scope !== "specific") return "your area"
  const first = (markets.markets || [])[0]
  if (!first) return "your area"
  return cityLabelForMarket(first) || "your area"
}

// Deep-clone Puck data and replace {Brand}/{City} in every string value.
export function interpolateSiteData(data: any, brand: string, city: string): any {
  const b = brand || "our team"
  const c = city || "your area"
  const walk = (v: any): any => {
    if (typeof v === "string") return v.split("{Brand}").join(b).split("{City}").join(c)
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === "object") {
      const out: any = {}
      for (const k of Object.keys(v)) out[k] = walk(v[k])
      return out
    }
    return v
  }
  return walk(data)
}
