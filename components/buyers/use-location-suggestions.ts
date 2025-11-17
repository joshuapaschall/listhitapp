"use client"

import { useEffect, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { searchLocations } from "@/lib/location-utils"

export function useLocationSuggestions(query: string, delay = 300) {
  const debouncedQuery = useDebounce(query, delay)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (debouncedQuery && debouncedQuery.length > 1) {
      setLoading(true)
      try {
        const results = searchLocations(debouncedQuery).slice(0, 20)
        setSuggestions(results)
      } catch (err) {
        console.error("Error searching locations:", err)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    } else {
      setSuggestions([])
    }
  }, [debouncedQuery])

  return { suggestions, loading }
}
