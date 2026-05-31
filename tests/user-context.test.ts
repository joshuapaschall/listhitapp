import { getUserMergeContext } from "../lib/user-context"

function createProfileClient(row: { full_name: string | null; display_name: string | null } | null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: row, error: null })),
        })),
      })),
    })),
  }
}

describe("getUserMergeContext", () => {
  test("resolves full_name", async () => {
    const client = createProfileClient({ full_name: "John Smith", display_name: "Johnny S" })

    await expect(getUserMergeContext(client, "user-1")).resolves.toEqual({
      myFirstName: "John",
      myLastName: "Smith",
    })
  })

  test("falls back to display_name", async () => {
    const client = createProfileClient({ full_name: null, display_name: "Jane Doe" })

    await expect(getUserMergeContext(client, "user-1")).resolves.toEqual({
      myFirstName: "Jane",
      myLastName: "Doe",
    })
  })

  test("returns empty strings when no profile exists", async () => {
    const client = createProfileClient(null)

    await expect(getUserMergeContext(client, "user-1")).resolves.toEqual({
      myFirstName: "",
      myLastName: "",
    })
  })
})
