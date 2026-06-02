import { NextRequest } from "next/server"

vi.mock("@/lib/permissions/server", () => ({
  requirePermission: vi.fn(async () => null),
}))

vi.mock("@/lib/offer-notifications", () => ({
  sendOfferStatusNotification: vi.fn(async () => undefined),
}))

vi.mock("@/lib/notifications", () => ({
  insertNotification: vi.fn(async () => undefined),
}))

const state = vi.hoisted(() => ({
  currentOffer: {
    id: "offer-1",
    status: "submitted",
    buyer_id: "buyer-1",
    property_id: "property-1",
    offer_price: 150000,
  } as Record<string, any>,
  property: { id: "property-1", buy_price: 100000 } as Record<string, any> | null,
  disposition: null as Record<string, any> | null,
  dispositionInsertError: null as { message: string } | null,
  dispositionInserts: [] as any[],
  dispositionUpdates: [] as any[],
  offerUpdates: [] as any[],
}))

class QueryBuilder {
  private selected = "*"
  private updatePayload: any = null
  private insertPayload: any = null
  private filters: Record<string, any> = {}

  constructor(private table: string) {}

  select(columns = "*") {
    this.selected = columns
    return this
  }

  update(payload: any) {
    this.updatePayload = payload
    return this
  }

  insert(payload: any) {
    this.insertPayload = payload
    return this
  }

  eq(column: string, value: any) {
    this.filters[column] = value
    return this
  }

  async maybeSingle() {
    if (this.table === "offers") return { data: state.currentOffer, error: null }
    if (this.table === "properties") return { data: state.property, error: null }
    if (this.table === "dispositions") return { data: state.disposition, error: null }
    return { data: null, error: null }
  }

  async single() {
    if (this.table === "offers" && this.updatePayload) {
      state.offerUpdates.push(this.updatePayload)
      state.currentOffer = { ...state.currentOffer, ...this.updatePayload }
      return { data: state.currentOffer, error: null }
    }

    return { data: state.currentOffer, error: null }
  }

  then(resolve: any) {
    if (this.table === "dispositions" && this.insertPayload) {
      if (state.dispositionInsertError) {
        return resolve({ data: null, error: state.dispositionInsertError })
      }
      const row = Array.isArray(this.insertPayload) ? this.insertPayload[0] : this.insertPayload
      state.dispositionInserts.push(row)
      state.disposition = { id: "disposition-1", ...row }
      return resolve({ data: [state.disposition], error: null })
    }

    if (this.table === "dispositions" && this.updatePayload) {
      state.dispositionUpdates.push({ ...this.updatePayload, filters: this.filters })
      state.disposition = { ...(state.disposition ?? { id: "disposition-1" }), ...this.updatePayload }
      return resolve({ data: [state.disposition], error: null })
    }

    return resolve({ data: [], error: null })
  }
}

const supabase = {
  from: (table: string) => new QueryBuilder(table),
}

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({
    user: { id: "user-1" },
    orgId: "org-1",
    supabase,
  }),
}))

function jsonRequest(body: Record<string, unknown>) {
  return new NextRequest("http://test/api/offers/offer-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function routeContext() {
  return { params: Promise.resolve({ id: "offer-1" }) }
}

describe("offer PATCH disposition sync", () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentOffer = {
      id: "offer-1",
      status: "submitted",
      buyer_id: "buyer-1",
      property_id: "property-1",
      offer_price: 150000,
    }
    state.property = { id: "property-1", buy_price: 100000 }
    state.disposition = null
    state.dispositionInsertError = null
    state.dispositionInserts = []
    state.dispositionUpdates = []
    state.offerUpdates = []
  })

  test("accepting an offer creates an under-contract disposition with economics", async () => {
    const { PATCH } = await import("../app/api/offers/[id]/route")

    const response = await PATCH(
      jsonRequest({
        status: "accepted",
        accepted_price: 150000,
        assignment_fee: 50000,
        deal_expenses: 2500,
      }),
      routeContext(),
    )

    expect(response.status).toBe(200)
    expect(state.offerUpdates[0]).toEqual(expect.objectContaining({
      status: "accepted",
      accepted_price: 150000,
      assignment_fee: 50000,
      deal_expenses: 2500,
    }))
    expect(state.dispositionInserts[0]).toEqual(expect.objectContaining({
      org_id: "org-1",
      sale_status: "under_contract",
      property_id: "property-1",
      buyer_id: "buyer-1",
      accepted_offer_id: "offer-1",
      buy_price: 100000,
      sale_price: 150000,
      assignment_fee: 50000,
      closing_expenses: 2500,
    }))
  })

  test("closing an offer flips the existing disposition to closed with a closing date", async () => {
    state.currentOffer = {
      ...state.currentOffer,
      status: "accepted",
      accepted_price: 150000,
      assignment_fee: 50000,
      deal_expenses: 2500,
    }
    state.disposition = { id: "disposition-1", accepted_offer_id: "offer-1", sale_status: "under_contract" }
    const { PATCH } = await import("../app/api/offers/[id]/route")

    const response = await PATCH(jsonRequest({ status: "closed" }), routeContext())

    expect(response.status).toBe(200)
    expect(state.dispositionUpdates[0]).toEqual(expect.objectContaining({
      sale_status: "closed",
      closing_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      filters: { id: "disposition-1" },
    }))
  })

  test("disposition insert failures do not fail the offer update", async () => {
    state.dispositionInsertError = { message: "RLS blocked disposition" }
    const { PATCH } = await import("../app/api/offers/[id]/route")

    const response = await PATCH(
      jsonRequest({ status: "accepted", accepted_price: 150000, assignment_fee: 50000, deal_expenses: 0 }),
      routeContext(),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe("accepted")
    expect(state.offerUpdates).toHaveLength(1)
  })
})
