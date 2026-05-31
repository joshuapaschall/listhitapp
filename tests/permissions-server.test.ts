import { getUserPermissions, hasPermission, requirePermission } from "../lib/permissions/server"

type Profile = {
  id: string
  role: string
}

type Permission = {
  user_id: string
  permission_key: string
  granted: boolean
}

let profiles: Profile[] = []
let permissions: Permission[] = []
let user: { id: string } | null = null

function createQuery(table: string) {
  let selected = "*"
  const filters: Record<string, unknown> = {}

  const query: any = {
    select: (columns: string) => {
      selected = columns
      return query
    },
    eq: (column: string, value: unknown) => {
      filters[column] = value
      return query
    },
    maybeSingle: async () => {
      if (table !== "profiles") throw new Error(`Unexpected maybeSingle table ${table}`)
      const row = profiles.find((profile) => profile.id === filters.id) ?? null
      return { data: row ? pickSelected(row, selected) : null, error: null }
    },
    then: (resolve: any, reject: any) => {
      Promise.resolve({ data: selectRows(table, selected, filters), error: null }).then(resolve, reject)
    },
  }

  return query
}

function pickSelected<T extends Record<string, unknown>>(row: T, selected: string) {
  if (selected === "*") return row
  return Object.fromEntries(
    selected.split(",").map((column) => column.trim()).map((column) => [column, row[column]])
  )
}

function selectRows(table: string, selected: string, filters: Record<string, unknown>) {
  if (table !== "permissions") throw new Error(`Unexpected table ${table}`)

  return permissions
    .filter((permission) =>
      Object.entries(filters).every(([column, value]) => (permission as any)[column] === value)
    )
    .map((permission) => pickSelected(permission, selected))
}

const client: any = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user }, error: null })),
  },
  from: (table: string) => createQuery(table),
}

describe("permissions server helpers", () => {
  beforeEach(() => {
    profiles = []
    permissions = []
    user = { id: "u1" }
    vi.clearAllMocks()
  })

  test("admin bypasses without permission rows", async () => {
    profiles.push({ id: "u1", role: "admin" })

    await expect(hasPermission(client, "buyers.delete")).resolves.toBe(true)
  })

  test("non-admin with granted row is allowed", async () => {
    profiles.push({ id: "u1", role: "user" })
    permissions.push({ user_id: "u1", permission_key: "buyers.delete", granted: true })

    await expect(hasPermission(client, "buyers.delete")).resolves.toBe(true)
  })

  test("non-admin without row is denied by default", async () => {
    profiles.push({ id: "u1", role: "user" })

    await expect(hasPermission(client, "buyers.delete")).resolves.toBe(false)
  })

  test("non-admin with granted false row is denied", async () => {
    profiles.push({ id: "u1", role: "user" })
    permissions.push({ user_id: "u1", permission_key: "buyers.delete", granted: false })

    await expect(hasPermission(client, "buyers.delete")).resolves.toBe(false)
  })

  test("no user is denied", async () => {
    user = null

    await expect(hasPermission(client, "buyers.view")).resolves.toBe(false)
  })

  test("getUserPermissions returns role and granted permission set", async () => {
    profiles.push({ id: "u1", role: "manager" })
    permissions.push(
      { user_id: "u1", permission_key: "buyers.view", granted: true },
      { user_id: "u1", permission_key: "buyers.delete", granted: false },
      { user_id: "u1", permission_key: "not.real", granted: true }
    )

    const result = await getUserPermissions(client, "u1")

    expect(result.role).toBe("manager")
    expect([...result.granted]).toEqual(["buyers.view"])
  })

  test("requirePermission returns null for allowed permission", async () => {
    profiles.push({ id: "u1", role: "user" })
    permissions.push({ user_id: "u1", permission_key: "buyers.view", granted: true })

    await expect(requirePermission(client, "buyers.view")).resolves.toBeNull()
  })

  test("requirePermission returns 403 with missingPermission for denied permission", async () => {
    profiles.push({ id: "u1", role: "user" })

    const response = await requirePermission(client, "buyers.delete")

    expect(response?.status).toBe(403)
    await expect(response?.json()).resolves.toEqual({
      error: "Forbidden",
      missingPermission: "buyers.delete",
    })
  })

  test("requirePermission returns 401 when no user is signed in", async () => {
    user = null

    const response = await requirePermission(client, "buyers.view")

    expect(response?.status).toBe(401)
    await expect(response?.json()).resolves.toEqual({ error: "Unauthorized" })
  })
})
