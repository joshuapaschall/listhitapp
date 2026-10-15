// Shared in-memory Supabase + auth mocks for the /api/dns/* route tests.

export type Row = Record<string, any>

export function makeDb(tables: Record<string, Row[]>) {
  const inserts: Record<string, Row[]> = {}
  const from = (table: string) => {
    const filters: Array<(r: Row) => boolean> = []
    let countMode = false
    const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
    const q: any = {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.count) countMode = true
        return q
      },
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), q),
      is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), q),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      insert: async (row: Row) => {
        ;(inserts[table] ||= []).push(row)
        ;(tables[table] ||= []).push({ ...row, created_at: new Date().toISOString() })
        return { error: null }
      },
      then: (res: any, rej: any) =>
        Promise.resolve(countMode ? { count: rows().length, error: null } : { data: rows(), error: null }).then(res, rej),
    }
    return q
  }
  return { client: { from }, inserts }
}
