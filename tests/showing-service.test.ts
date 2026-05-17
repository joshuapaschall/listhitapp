import { ShowingService } from "../services/showing-service"

describe("ShowingService", () => {
  beforeEach(() => {
    ;(global.fetch as vi.Mock | undefined)?.mockReset?.()
  })

  test("getShowings calls GET /api/showings with query params", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "1", buyer_id: "b1" }],
    }) as any

    const data = await ShowingService.getShowings({ buyerId: "b1", status: "scheduled" })

    expect(global.fetch).toHaveBeenCalledWith("/api/showings?buyerId=b1&status=scheduled", { method: "GET" })
    expect(data).toHaveLength(1)
  })

  test("addShowing calls POST /api/showings with body", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "2" }) }) as any

    await ShowingService.addShowing({ property_id: "p1", scheduled_at: "2024-01-01T00:00:00Z" })

    expect(global.fetch).toHaveBeenCalledWith("/api/showings", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }))
  })

  test("updateShowing calls PATCH /api/showings/{id}", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "3" }) }) as any

    await ShowingService.updateShowing("3", { status: "completed" })

    expect(global.fetch).toHaveBeenCalledWith("/api/showings/3", expect.objectContaining({ method: "PATCH" }))
  })

  test("deleteShowing calls DELETE /api/showings/{id}", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any

    await ShowingService.deleteShowing("4")

    expect(global.fetch).toHaveBeenCalledWith("/api/showings/4", { method: "DELETE" })
  })
})
