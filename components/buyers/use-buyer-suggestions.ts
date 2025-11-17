"use client"

import { useEffect, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { BuyerService } from "@/services/buyer-service"
import type { Buyer } from "@/lib/supabase"

export function useBuyerSuggestions(query: string, open: boolean, delay = 300) {
  const debouncedQuery = useDebounce(query, delay)
  const [results, setResults] = useState<Buyer[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setResults([])
      return
    }

    const fetchData = async () => {
      setLoading(true)
      try {
        let data: Buyer[]
        if (debouncedQuery && debouncedQuery.length > 1) {
          data = await BuyerService.searchBuyers(debouncedQuery)
        } else {
          data = await BuyerService.listBuyers()
        }
        const displayName = (b: Buyer) =>
          (b.full_name || `${b.fname || ""} ${b.lname || ""}`).trim()
        data.sort((a, b) =>
          displayName(a).localeCompare(displayName(b), undefined, {
            sensitivity: "base",
          }),
        )
        setResults(data)
      } catch (err) {
        console.error("Error searching buyers:", err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [debouncedQuery, open])

  return { results, loading }
}
