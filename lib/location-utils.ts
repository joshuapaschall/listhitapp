export interface LocationRecord {
  city: string
  county: string
  state: string
  state_id: string
}

import locationsData from "./locations"

let cache: LocationRecord[] | null = null

function getLocations(): LocationRecord[] {
  if (!cache) {
    cache = locationsData as LocationRecord[]
  }
  return cache
}

export function searchLocations(query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results: { text: string; score: number }[] = []
  const added = new Set<string>()
  const locations = getLocations()

  for (const loc of locations) {
    const city = loc.city.toLowerCase()
    const county = loc.county.toLowerCase()
    const state = loc.state.toLowerCase()
    const stateId = loc.state_id.toLowerCase()

    let score = Infinity
    let formatted = ""

    const cityIndex = city.indexOf(q)
    const countyIndex = county.indexOf(q)
    const stateIndex = state.indexOf(q)
    const idIndex = stateId.indexOf(q)

    if (cityIndex !== -1) {
      formatted = `${loc.city} (${loc.state_id})`
      score = cityIndex
    }
    if (countyIndex !== -1 && countyIndex < score) {
      const countyName = loc.county.includes("County") ? loc.county : `${loc.county} County`
      formatted = `${countyName} (${loc.state_id})`
      score = countyIndex
    }
    if (stateIndex !== -1 && stateIndex < score) {
      formatted = `${loc.state_id}, USA`
      score = stateIndex
    }
    if (idIndex !== -1 && idIndex < score) {
      formatted = `${loc.state_id}, USA`
      score = idIndex
    }

    if (formatted && !added.has(formatted)) {
      added.add(formatted)
      results.push({ text: formatted, score })
    }
  }

  results.sort((a, b) => a.score - b.score)

  return results.map((r) => r.text)
}
