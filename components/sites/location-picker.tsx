"use client"
import React, { useEffect, useState } from "react"

// Reusable nationwide location picker. Queries the public locations endpoint
// and stores the EXACT canonical strings it returns (city, county, or state
// form) so selections line up with buyers.locations, site markets, and campaign
// audience filters. All location data comes from the API, never hardcoded.

const INK = "#0f1b29"
const MUT = "#5a6675"
const LINE = "#e8ebf1"
const CHIP_BORDER = "#d9dee6"

function classify(s: string): string {
  if (/,\s*USA\s*$/i.test(s)) return "State"
  if (/county/i.test(s)) return "County"
  return "City"
}

function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function IconPin({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function LocationPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<string[]>([])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/public/locations?q=${encodeURIComponent(q)}`, { credentials: "omit" })
        const data = await res.json().catch(() => ({}))
        if (data?.ok && Array.isArray(data.results)) setResults(data.results)
      } catch {
        /* ignore typeahead errors */
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const add = (loc: string) => {
    if (!value.includes(loc)) onChange([...value, loc])
    setQuery("")
    setResults([])
  }
  const remove = (loc: string) => onChange(value.filter((l) => l !== loc))

  const helper =
    value.length > 0
      ? `${value.length} added · keep adding as many as you'd like.`
      : "Start typing — a state, county, or city. Add as many as you want."

  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 9 }}>
          {value.map((loc) => (
            <span
              key={loc}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 11px",
                borderRadius: 999,
                background: "color-mix(in srgb, var(--p) 8%, #fff)",
                color: "var(--p)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <span style={{ display: "inline-flex" }}><IconPin /></span>
              {loc}
              <span
                role="button"
                aria-label={`Remove ${loc}`}
                onClick={() => remove(loc)}
                style={{ cursor: "pointer", fontSize: 15, lineHeight: 1, marginLeft: 1 }}
              >
                ×
              </span>
            </span>
          ))}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: MUT, display: "inline-flex", pointerEvents: "none" }}>
          <IconSearch />
        </span>
        <input
          style={{
            width: "100%",
            padding: "12px 14px 12px 38px",
            borderRadius: 11,
            border: `1px solid ${CHIP_BORDER}`,
            fontSize: 15,
            outline: "none",
            background: "#fff",
            color: INK,
            boxSizing: "border-box",
          }}
          placeholder="Search a state, county, or city…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search locations"
        />
        {results.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "100%",
              zIndex: 20,
              marginTop: 5,
              background: "#fff",
              border: `1px solid ${LINE}`,
              borderRadius: 12,
              boxShadow: "0 12px 30px rgba(16,27,41,.14)",
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            {results.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => add(r)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 14px",
                  border: "none",
                  borderBottom: "1px solid #f2f4f7",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 14.5,
                  color: INK,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  <span style={{ color: MUT, display: "inline-flex" }}><IconPin /></span>
                  {r}
                </span>
                <span style={{ fontSize: 11, color: MUT, flexShrink: 0, marginLeft: 10 }}>{classify(r)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p style={{ marginTop: 8, fontSize: 12.5, color: MUT }}>{helper}</p>
    </div>
  )
}
