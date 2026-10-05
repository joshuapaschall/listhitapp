"use client"

import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query"

import { invalidateFieldOptions } from "@/lib/segments/use-field-options"

export type OrgTag = {
  id: string
  name: string
  // tags.color is NOT NULL with a '#3B82F6' default.
  color: string
  is_protected: boolean
}

// One shared read of the org's tag vocabulary. Every picker uses this instead of
// querying the tags table itself, so a rename or merge is reflected everywhere
// after a single invalidation.
export function useOrgTags(): UseQueryResult<OrgTag[]> {
  return useQuery<OrgTag[]>({
    queryKey: ["tags"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch("/api/tags")
      if (!res.ok) throw new Error("Failed to load tags")
      const body = await res.json()
      return (body.tags ?? []) as OrgTag[]
    },
  })
}

/**
 * A tag rename/merge/delete rewrites buyers, properties, segments and draft
 * campaigns in one transaction, so every surface that renders or filters by tag
 * name is stale afterwards — not just the tag list.
 */
export function useInvalidateTagViews(): () => Promise<void> {
  const queryClient = useQueryClient()

  return async () => {
    await Promise.all(
      [
        ["tags"],
        ["settings-tags"],
        ["buyers"],
        ["properties"],
        ["segments"],
        ["campaigns"],
        ["buyerCountsByGroup"],
        ["channelCounts"],
        ["totalBuyersCount"],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )
    // The segment builder caches its own option lists outside React Query.
    invalidateFieldOptions("tags")
  }
}
