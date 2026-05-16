import { jest } from "@jest/globals"

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
    chain[method] = jest.fn((..._args: any[]) => chain)
  }
  chain.single = jest.fn(async () => ({ data: Array.isArray(resolveData) ? resolveData[0] ?? null : resolveData, error: null }))
  chain.maybeSingle = jest.fn(async () => ({ data: Array.isArray(resolveData) ? resolveData[0] ?? null : resolveData, error: null }))
  chain.then = (resolve: any) => resolve({ data: resolveData, error: null })
  chain.throwOnError = jest.fn(() => chain)
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
    getUser: jest.fn(async () => ({ data: { user: null }, error: null })),
  },
  channel: jest.fn(() => ({
    on: () => ({
      subscribe: () => ({}) as any,
    }),
  })),
  removeChannel: jest.fn(),
}

export const supabaseAdmin = supabase
