import { describe, expect, test, beforeEach } from "@jest/globals"
import { OfferService } from "../services/offer-service"

let offers: any[] = []
let idCounter = 1

jest.mock("../lib/supabase", () => {
  const client = {
      from: (table: string) => {
        if (table !== "offers") throw new Error(`Unexpected table ${table}`)

        return {
          insert: (rows: any[]) => {
            const record = { id: String(idCounter++), ...rows[0] }
            offers.push(record)
            return {
              select: () => ({ single: async () => ({ data: record, error: null }) })
            }
          },

          select: () => {
            let result = [...offers]
            const chain: any = {
              order: () => chain,
              eq: (column: string, value: any) => {
                result = result.filter((r) => r[column] === value)
                return chain
              },
              then: async (resolve: any) => resolve({ data: result, error: null })
            }
            return chain
          },

          update: (updates: any) => ({
            eq: (column: string, value: any) => ({
              select: () => ({
                single: async () => {
                  const idx = offers.findIndex((o) => o[column] === value)
                  if (idx === -1) return { data: null, error: null }
                  offers[idx] = { ...offers[idx], ...updates }
                  return { data: offers[idx], error: null }
                }
              })
            })
          }),

          delete: () => ({
            eq: async (column: string, value: any) => {
              const idx = offers.findIndex((o) => o[column] === value)
              if (idx !== -1) offers.splice(idx, 1)
              return { error: null }
            }
          })
        }
      }
    }
  return { supabase: client, supabaseAdmin: client }
})

describe("OfferService", () => {
  beforeEach(() => {
    offers = []
    idCounter = 1
  })

  test("addOffer inserts and returns record", async () => {
    const offer = await OfferService.addOffer({
      buyer_id: "b1",
      property_id: "p1",
      offer_price: 100000,
      status: "pending"
    })

    expect(offer.id).toBeDefined()
    expect(offer.buyer_id).toBe("b1")
  })

  test("updateOffer updates fields including status timestamp", async () => {
    const offer = await OfferService.addOffer({
      buyer_id: "b1",
      property_id: "p1",
      status: "submitted",
    })

    const updated = await OfferService.updateOffer(offer.id, {
      offer_price: 200000,
      status: "accepted",
    })

    expect(updated.offer_price).toBe(200000)
    expect(updated.status).toBe("accepted")
    expect(updated.accepted_at).toBeDefined()
  })

  test("getOffers filters by buyerId and status", async () => {
    await OfferService.addOffer({ buyer_id: "b1", property_id: "p1", status: "pending" })
    await OfferService.addOffer({ buyer_id: "b2", property_id: "p2", status: "accepted" })

    const results = await OfferService.getOffers({ buyerId: "b1", status: "pending" })
    expect(results.length).toBe(1)
    expect(results[0].buyer_id).toBe("b1")
  })

  test("getOffers filters by propertyId", async () => {
    await OfferService.addOffer({ buyer_id: "b1", property_id: "p1", status: "pending" })
    await OfferService.addOffer({ buyer_id: "b2", property_id: "p2", status: "pending" })

    const results = await OfferService.getOffers({ propertyId: "p2" })

    expect(results.length).toBe(1)
    expect(results[0].property_id).toBe("p2")
  })

  test("updateOfferStatus updates status", async () => {
    const offer = await OfferService.addOffer({ buyer_id: "b1", property_id: "p1", status: "pending" })

    const updated = await OfferService.updateOfferStatus(offer.id, "accepted")
    expect(updated.status).toBe("accepted")
    expect(updated.accepted_at).toBeDefined()
  })

  test.each([
    ["rejected", "rejected_at"],
    ["withdrawn", "withdrawn_at"],
    ["countered", "countered_at"],
    ["closed", "closed_at"],
    ["submitted", "submitted_at"],
  ])("updateOfferStatus sets %s timestamp", async (status, field) => {
    const offer = await OfferService.addOffer({
      buyer_id: "b1",
      property_id: "p1",
      status: "pending",
    })

    const updated = await OfferService.updateOfferStatus(offer.id, status as string)
    expect(updated.status).toBe(status)
    // @ts-ignore
    expect(updated[field as keyof typeof updated]).toBeDefined()
  })

  test("deleteOffer removes record", async () => {
    const offer = await OfferService.addOffer({ buyer_id: "b1", property_id: "p1", status: "pending" })
    await OfferService.deleteOffer(offer.id)
    const results = await OfferService.getOffers()
    expect(results.length).toBe(0)
  })
})
