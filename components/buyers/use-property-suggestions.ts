"use client"

import { useEffect, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { PropertyService } from "@/services/property-service"
import type { Property } from "@/lib/supabase"

export function usePropertySuggestions(query: string, delay = 300) {
  const debouncedQuery = useDebounce(query, delay)
  const [results, setResults] = useState<Property[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (debouncedQuery && debouncedQuery.length > 1) {
      setLoading(true)
      PropertyService.searchProperties(debouncedQuery)
        .then((data) => setResults(data))
        .catch((err) => {
          console.error("Error searching properties:", err)
          setResults([])
        })
        .finally(() => setLoading(false))
    } else {
      setResults([])
    }
  }, [debouncedQuery])

  return { results, loading }
}
