// PostgREST caps every response at 1,000 rows. An org with more than 1,000 tags
// would silently see a truncated vocabulary: ensureTagsExist would re-create
// tags it couldn't see, and the pickers would hide the rest. Page explicitly.

export const PAGE_SIZE = 1000

/**
 * Walk `.range(from, from + 999)` until a short page comes back.
 *
 * `fetchPage` must apply a stable ORDER BY, or paging can skip or repeat rows.
 */
export async function fetchAllPages<T>(
  // PromiseLike, not Promise: a Supabase query builder is a thenable.
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ rows: T[]; error: unknown }> {
  const rows: T[] = []
  let from = 0

  for (;;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) return { rows, error }

    const page = data ?? []
    rows.push(...page)

    if (page.length < PAGE_SIZE) return { rows, error: null }
    from += PAGE_SIZE
  }
}
