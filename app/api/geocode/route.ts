import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const { query } = await request.json()
  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ latitude: null, longitude: null }), {
      status: 400,
    })
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { "User-Agent": "dispotool" } },
    )
    if (!res.ok) {
      return new Response(JSON.stringify({ latitude: null, longitude: null }), {
        status: res.status,
      })
    }
    const results = await res.json()
    if (Array.isArray(results) && results.length > 0) {
      const lat = parseFloat(results[0].lat)
      const lon = parseFloat(results[0].lon)
      return new Response(
        JSON.stringify({ latitude: lat, longitude: lon }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  } catch (err) {
    console.error("Geocoding failed", err)
  }

  return new Response(JSON.stringify({ latitude: null, longitude: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
