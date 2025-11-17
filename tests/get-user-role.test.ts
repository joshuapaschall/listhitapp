import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { getUserRole } from "../lib/get-user-role"

let profiles: any[] = []
let user: any

const client: any = {
  auth: {
    getUser: jest.fn(async () => ({ data: { user }, error: null })),
  },
  from: (table: string) => {
    if (table !== "profiles") throw new Error(`Unexpected table ${table}`)
    return {
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => ({
            data: profiles.find((p) => p.id === id) || null,
            error: null,
          }),
        }),
      }),
    }
  },
}

describe("getUserRole", () => {
  beforeEach(() => {
    profiles = []
    user = { id: "u1" }
  })

  test("returns profile role", async () => {
    profiles.push({ id: "u1", role: "admin" })
    const role = await getUserRole(client)
    expect(role).toBe("admin")
  })

  test("defaults to user when profile missing", async () => {
    const role = await getUserRole(client)
    expect(role).toBe("user")
  })
})
