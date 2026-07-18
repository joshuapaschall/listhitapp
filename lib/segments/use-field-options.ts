"use client"

import { useEffect, useState } from "react"

export type FieldOption = {
  value: string
  label: string
  channel?: "email" | "sms" | null
  sentAt?: string | null
}

export type OptionField =
  | "tags"
  | "locations"
  | "status"
  | "source"
  | "property_type"
  | "campaigns"
  | "groups"

// Simple module-level in-memory cache so repeated condition rows don't refetch
// the same option list. Keyed by field; lives for the page session.
const cache = new Map<OptionField, FieldOption[]>()
const inflight = new Map<OptionField, Promise<FieldOption[]>>()

async function fetchOptions(field: OptionField): Promise<FieldOption[]> {
  if (cache.has(field)) return cache.get(field)!
  if (inflight.has(field)) return inflight.get(field)!

  const promise = (async () => {
    const res = await fetch(`/api/segments/options?field=${encodeURIComponent(field)}`)
    if (!res.ok) throw new Error(`Failed to load options for ${field}`)
    const json = await res.json()
    const options: FieldOption[] = Array.isArray(json?.options) ? json.options : []
    cache.set(field, options)
    inflight.delete(field)
    return options
  })()

  inflight.set(field, promise)
  return promise
}

/** Manually clear the option cache (e.g. after creating a new tag). */
export function invalidateFieldOptions(field?: OptionField) {
  if (field) cache.delete(field)
  else cache.clear()
}

export function useFieldOptions(field: OptionField | null) {
  const [options, setOptions] = useState<FieldOption[]>(field ? cache.get(field) ?? [] : [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!field) return
    let active = true
    setLoading(true)
    setError(null)
    fetchOptions(field)
      .then((opts) => {
        if (active) setOptions(opts)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Failed to load options")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [field])

  return { options, loading, error }
}
