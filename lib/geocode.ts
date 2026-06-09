// In-process geocoder (Nominatim / OpenStreetMap). Call this directly from
// server routes — no auth, no self-HTTP round-trip (which dropped the session
// cookie and 401'd). Returns nulls on any failure; never throws.
export async function geocodeAddress(
  query: string,
): Promise<{ latitude: number | null; longitude: number | null }> {
  if (!query || typeof query !== "string") return { latitude: null, longitude: null }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { "User-Agent": "dispotool" } },
    )
    if (!res.ok) return { latitude: null, longitude: null }
    const results = await res.json()
    if (Array.isArray(results) && results.length > 0) {
      return { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) }
    }
  } catch (err) {
    console.error("Geocoding failed:", err)
  }
  return { latitude: null, longitude: null }
}
