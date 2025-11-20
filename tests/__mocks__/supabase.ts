import { jest } from "@jest/globals"

type TableHandler = (table: string) => any

let buyerGroupsData: any[] = []

export function __setBuyerGroups(data: any[]) {
  buyerGroupsData = data
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
  return {
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ error: null }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
  }
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
