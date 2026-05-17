import { vi } from "vitest"

type TableHandler = (table: string) => any

let buyerGroupsData: any[] = []

export function __setBuyerGroups(data: any[]) {
  buyerGroupsData = data
}

function createChainMock(resolveData: any = []) {
  const chain: any = {}
  const methods = [
    "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike",
    "is", "in", "not", "or", "and", "filter",
    "order", "limit", "range", "offset",
    "match", "textSearch", "contains", "containedBy", "overlaps",
    "csv", "returns",
  ]
  for (const method of methods) {
    chain[method] = vi.fn((..._args: any[]) => chain)
  }
  chain.single = vi.fn(async () => ({ data: Array.isArray(resolveData) ? resolveData[0] ?? null : resolveData, error: null }))
  chain.maybeSingle = vi.fn(async () => ({ data: Array.isArray(resolveData) ? resolveData[0] ?? null : resolveData, error: null }))
  chain.then = (resolve: any) => resolve({ data: resolveData, error: null })
  chain.throwOnError = vi.fn(() => chain)
  return chain
}

const buyerGroupsHandler = () => ({
  select: () => ({
    in: (col1: string, vals1: any[]) => ({
      in: (col2: string, vals2: any[]) => {
        const data = buyerGroupsData.filter(
          (bg) => vals1.includes(bg[col1]) && vals2.includes(bg[col2]),
        )
        return Promise.resolve({ data, error: null })
      },
    }),
  }),
  insert: (rows: any[]) => {
    buyerGroupsData.push(...rows)
    return Promise.resolve({ data: rows, error: null })
  },
})

export const fromMock: TableHandler = (table: string) => {
  if (table === "buyer_groups") return buyerGroupsHandler()
  return createChainMock()
}

export const supabase = {
  from: (table: string) => fromMock(table),
  auth: {
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  },
  channel: vi.fn(() => ({
    on: () => ({
      subscribe: () => ({}) as any,
    }),
  })),
  removeChannel: vi.fn(),
}

export const supabaseAdmin = supabase
