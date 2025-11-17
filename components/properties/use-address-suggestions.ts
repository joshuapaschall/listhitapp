"use client"

import { useEffect, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

export interface AddressSuggestion {
  label: string
  address: string
  city: string
  state: string
  zip: string
  latitude: number
  longitude: number
}

export function useAddressSuggestions(query: string, open: boolean, delay = 300) {
  const debouncedQuery = useDebounce(query, delay)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || debouncedQuery.trim().length < 3 || !MAPBOX_TOKEN) {
      setSuggestions([])
      return
    }

    const controller = new AbortController()

    const fetchData = async () => {
      setLoading(true)
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          debouncedQuery,
        )}.json?autocomplete=true&types=address&limit=5&access_token=${MAPBOX_TOKEN}`
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error(res.statusText)
        const data = await res.json()
        const items = (data.features || []).map((f: any) => {
          const ctx: any[] = f.context || []
          const cityObj = ctx.find((c) => (c.id || "").includes("place"))
          const regionObj = ctx.find((c) => (c.id || "").includes("region"))
          const zipObj = ctx.find((c) => (c.id || "").includes("postcode"))
          const state = regionObj?.short_code
            ? regionObj.short_code.split("-").pop()
            : regionObj?.text || ""
          return {
            label: f.place_name as string,
            address: [f.address, f.text].filter(Boolean).join(" "),
            city: cityObj?.text || "",
            state,
            zip: zipObj?.text || "",
            latitude: f.center[1],
            longitude: f.center[0],
          } as AddressSuggestion
        })
        setSuggestions(items)
      } catch (err) {
        console.error("Error fetching address suggestions:", err)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    return () => controller.abort()
  }, [debouncedQuery, open])

  return { suggestions, loading }
}

