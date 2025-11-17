import { describe, expect, test } from "@jest/globals"
import {
  fetchTextTrends,
  fetchCallTrends,
  fetchEmailTrends,
  fetchOfferTrends,
  fetchShowingTrends,
  fetchUnsubscribeTrends,
} from "../services/dashboard-service"

describe("dashboard trends", () => {
  test("fetchTextTrends returns data", async () => {
    const res = await fetchTextTrends("week")
    expect(res.data.length).toBeGreaterThan(0)
    expect(typeof res.delta).toBe("number")
  })

  test("fetchCallTrends returns data", async () => {
    const res = await fetchCallTrends("week")
    expect(res.data.length).toBeGreaterThan(0)
  })

  test("fetchEmailTrends returns data", async () => {
    const res = await fetchEmailTrends("week")
    expect(res.data.length).toBeGreaterThan(0)
  })

  test("fetchOfferTrends returns data", async () => {
    const res = await fetchOfferTrends("week")
    expect(res.data.length).toBeGreaterThan(0)
  })

  test("fetchShowingTrends returns data", async () => {
    const res = await fetchShowingTrends("week")
    expect(res.data.length).toBeGreaterThan(0)
  })

  test("fetchUnsubscribeTrends returns data", async () => {
    const res = await fetchUnsubscribeTrends("week")
    expect(res.data.length).toBeGreaterThan(0)
  })
})
