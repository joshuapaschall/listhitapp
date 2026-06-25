import type { PropertyComp } from "@/lib/site-builder/types"

export function normalizeComps(input: unknown): PropertyComp[] {
  if (!Array.isArray(input)) return []
  const out: PropertyComp[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue
    const r = raw as Record<string, unknown>
    const address = typeof r.address === "string" ? r.address.trim().slice(0, 160) : ""
    if (!address) continue // address is required for a row to persist
    let sold_price: number | null = null
    if (typeof r.sold_price === "number" && isFinite(r.sold_price)) sold_price = Math.round(r.sold_price)
    else if (typeof r.sold_price === "string") {
      const n = Number(r.sold_price.replace(/[^0-9.]/g, ""))
      sold_price = isFinite(n) && n > 0 ? Math.round(n) : null
    }
    let url: string | null = null
    if (typeof r.url === "string") {
      const u = r.url.trim()
      url = /^https?:\/\//i.test(u) ? u.slice(0, 500) : null
    }
    out.push({ address, sold_price, url })
    if (out.length >= 12) break // sane cap
  }
  return out
}
