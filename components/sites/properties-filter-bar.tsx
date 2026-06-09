"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type BarValues = { sort: string; beds: string; baths: string; terms: string }

export function PropertiesFilterBar({
  basePath = "/properties",
  initial,
}: {
  basePath?: string
  initial: BarValues
}) {
  const router = useRouter()
  const [v, setV] = useState<BarValues>(initial)

  function update(patch: Partial<BarValues>) {
    const next = { ...v, ...patch }
    setV(next)
    const p = new URLSearchParams()
    if (next.sort && next.sort !== "new") p.set("sort", next.sort)
    if (next.beds && next.beds !== "0") p.set("beds", next.beds)
    if (next.baths && next.baths !== "0") p.set("baths", next.baths)
    if (next.terms && next.terms !== "any") p.set("terms", next.terms)
    const qs = p.toString()
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
      <style>{`
        .lh-pf-sel{height:40px;border:1px solid #d6dde6;background:#fff;color:#1f2a36;border-radius:10px;padding:0 30px 0 12px;font-size:14px;font-family:inherit;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='%237386a0' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>");background-repeat:no-repeat;background-position:right 9px center}
        .lh-pf-sel:hover{border-color:#b7c3d2}
        .lh-pf-sel:focus{outline:none;border-color:var(--p);box-shadow:0 0 0 3px color-mix(in srgb, var(--p) 20%, transparent)}
        .lh-pf-lab{font-size:12px;color:#5b6b7e;font-weight:500;margin-bottom:6px;text-align:center}
        .lh-pf-col{display:flex;flex-direction:column;align-items:center}
      `}</style>
      <div
        style={{
          display: "inline-flex",
          gap: 22,
          alignItems: "flex-end",
          flexWrap: "wrap",
          justifyContent: "center",
          background: "rgba(15,27,41,0.03)",
          border: "1px solid rgba(15,27,41,0.08)",
          borderRadius: 14,
          padding: "14px 24px",
        }}
      >
        <div className="lh-pf-col">
          <div className="lh-pf-lab">Sort By</div>
          <select
            className="lh-pf-sel"
            style={{ width: 156 }}
            value={v.sort}
            onChange={(e) => update({ sort: e.target.value })}
          >
            <option value="new">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
        <div className="lh-pf-col">
          <div className="lh-pf-lab">Beds</div>
          <select
            className="lh-pf-sel"
            style={{ width: 92 }}
            value={v.beds}
            onChange={(e) => update({ beds: e.target.value })}
          >
            <option value="0">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5+</option>
          </select>
        </div>
        <div className="lh-pf-col">
          <div className="lh-pf-lab">Baths</div>
          <select
            className="lh-pf-sel"
            style={{ width: 92 }}
            value={v.baths}
            onChange={(e) => update({ baths: e.target.value })}
          >
            <option value="0">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
          </select>
        </div>
        <div className="lh-pf-col">
          <div className="lh-pf-lab">Terms</div>
          <select
            className="lh-pf-sel"
            style={{ width: 150 }}
            value={v.terms}
            onChange={(e) => update({ terms: e.target.value })}
          >
            <option value="any">Any</option>
            <option value="cash">Cash</option>
            <option value="owner_finance">Owner finance</option>
            <option value="subject_to">Subject-to</option>
            <option value="land_contract">Land contract</option>
          </select>
        </div>
      </div>
    </div>
  )
}
