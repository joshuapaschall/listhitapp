// Shared helpers to read past PostgREST's default 1000-row cap. Mirrors the
// pagination pattern in lib/segments/resolver.ts (collectColumn).

const PAGE_SIZE = 1000

/**
 * Paginate a SELECT past the 1000-row cap. `buildQuery` MUST return a FRESH builder
 * on every call — Postgrest builders can only be awaited once. `orderColumn` must be a
 * stable, unique-ish column (e.g. a uuid `id`) so paging is deterministic.
 */
export async function fetchAllRows<T = any>(
  buildQuery: () => any,
  orderColumn: string,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery()
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return out
}

/**
 * Query rows for a large id set by chunking the `.in()` input — avoids both the 1000-row
 * cap and URL-length overflow. `buildChunkQuery` receives ONE id chunk and MUST return a
 * FRESH builder. chunkSize stays < 1000 so no single chunk can be capped.
 */
export async function fetchRowsByIdChunks<T = any>(
  ids: string[],
  buildChunkQuery: (chunk: string[]) => any,
  chunkSize = 500,
): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    if (chunk.length === 0) continue
    const { data, error } = await buildChunkQuery(chunk)
    if (error) throw error
    out.push(...((data ?? []) as T[]))
  }
  return out
}
