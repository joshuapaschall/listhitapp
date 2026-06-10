"use client"
import React, { useEffect, useState } from "react"

// Reusable nationwide location picker. Queries the public locations endpoint
// (31k US places) and stores the EXACT canonical strings it returns (city,
// county, or state form) so selections line up with buyers.locations, site
// markets, and campaign audience filters.
//
// Shows only a search box and the selected tags — no canned region shortcuts and
// no tenant-market surfacing. All location data comes from the API, never hardcoded.
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #d7dde4",
  fontSize: 16,
  outline: "none",
  background: "#fff",
  color: "#0f1b29",
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
      : `Start typing — a state like "Texas", a county, or a city. Add as many as you want.`

  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {value.map((loc) => (
            <span
              key={loc}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: 999,
                background: "color-mix(in srgb, var(--p) 10%, #fff)",
                color: "var(--p)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {loc}
              <span
                role="button"
                aria-label={`Remove ${loc}`}
                onClick={() => remove(loc)}
                style={{ cursor: "pointer", fontSize: 16, lineHeight: 1 }}
              >
                ×
              </span>
            </span>
          ))}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <input
          style={inputStyle}
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
              marginTop: 4,
              background: "#fff",
              border: "1px solid #e5e9ef",
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
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  border: "none",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 15,
                  color: "#0f1b29",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      <p style={{ marginTop: 8, fontSize: 13, color: "#8a94a2" }}>{helper}</p>
    </div>
  )
}
