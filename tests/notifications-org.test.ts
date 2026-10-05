// notifications.org_id loses its GWH column default in Phase 1B, so every
// service-role insert has to name its tenant — enforced at the type level so a
// caller cannot forget.

const state = vi.hoisted(() => ({ inserts: [] as any[], error: null as any }))

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "notifications") throw new Error(`Unexpected table ${table}`)
      return {
        insert: async (row: any) => {
          state.inserts.push(row)
          return { error: state.error }
        },
      }
    },
  },
}))

vi.mock("@/utils/assert-server", () => ({ assertServer: () => {} }))

import { insertNotification } from "@/lib/notifications"

describe("insertNotification", () => {
  beforeEach(() => {
    state.inserts = []
    state.error = null
  })

  test("writes org_id", async () => {
    await insertNotification({
      type: "offer_accepted",
      title: "Offer accepted",
      orgId: "org-A",
      body: "a body",
      metadata: { offerId: "o1" },
    })

    expect(state.inserts).toEqual([
      {
        type: "offer_accepted",
        title: "Offer accepted",
        org_id: "org-A",
        body: "a body",
        metadata: { offerId: "o1" },
      },
    ])
  })

  test("defaults body and metadata but never the org", async () => {
    await insertNotification({ type: "t", title: "T", orgId: "org-B" })
    expect(state.inserts[0]).toEqual({
      type: "t",
      title: "T",
      org_id: "org-B",
      body: null,
      metadata: {},
    })
  })

  test("logs rather than throws when the insert fails", async () => {
    state.error = { message: "boom" }
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(
      insertNotification({ type: "t", title: "T", orgId: "org-A" }),
    ).resolves.toBeUndefined()
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  test("orgId is required at the type level", async () => {
    // @ts-expect-error orgId is required — a call that omits it must not compile.
    await insertNotification({ type: "t", title: "T", body: "no org" })
    // The call still runs (the guard is compile-time only); at runtime it would
    // write an undefined org, which the NOT NULL column rejects.
    expect(state.inserts).toHaveLength(1)
  })
})
