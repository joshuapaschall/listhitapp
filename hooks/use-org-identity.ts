"use client"

import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import { orgIdentityFromRow, type OrgIdentity, type OrgIdentityRow } from "@/lib/org-identity"

/**
 * Shared cache key. The org settings page invalidates this after a save so a
 * template preview reflects the new business name immediately.
 *
 * GET /api/organization returns the organization row itself, not a wrapper.
 */
export const ORGANIZATION_QUERY_KEY = ["organization"] as const

export function useOrgIdentity(): UseQueryResult<OrgIdentity | null> {
  return useQuery<OrgIdentity | null>({
    queryKey: ORGANIZATION_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch("/api/organization")
      if (!res.ok) return null
      const body = await res.json()
      // Tolerate both shapes so a future wrapper doesn't silently blank the brand.
      const row = (body?.organization ?? body) as OrgIdentityRow | null
      return orgIdentityFromRow(row)
    },
  })
}
