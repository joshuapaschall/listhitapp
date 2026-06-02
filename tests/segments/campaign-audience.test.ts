import { readFileSync } from "node:fs"
import path from "node:path"
import { resolveAudienceSelection } from "../../lib/segments/audience"
import type { AudienceSelection } from "../../lib/segments/audience"
import type { SegmentDefinition } from "../../lib/segments/types"

const h = vi.hoisted(() => ({ segments: [] as any[] }))

vi.mock("@/services/segment-service", () => ({
  EMPTY_DEFINITION: { match: "all", conditions: [] },
  SegmentService: {
    getSegment: async (id: string) => h.segments.find((s) => s.id === id) ?? null,
  },
}))

function fetchReturning(buyerIds: string[]) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ buyerIds, count: buyerIds.length }),
  })) as any
}

const PRESET_DEF: SegmentDefinition = {
  match: "all",
  conditions: [{ kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "last_n_campaigns", n: 1 } }],
}

describe("resolveAudienceSelection", () => {
  test("preset selection → audience_definition set, segment_id null, buyer_ids + count from resolve", async () => {
    const sel: AudienceSelection = { kind: "preset", presetId: "clicked_last", definition: PRESET_DEF }
    const patch = await resolveAudienceSelection(sel, "email", "camp-1", fetchReturning(["a", "b"]))

    expect(patch.segment_id).toBeNull()
    expect(patch.audience_definition).toEqual(PRESET_DEF)
    expect(patch.buyer_ids).toEqual(["a", "b"])
    expect(patch.audience_preview_count).toBe(2)
  })

  test("inline selection → audience_definition set, segment_id null", async () => {
    const sel: AudienceSelection = { kind: "inline", definition: PRESET_DEF }
    const patch = await resolveAudienceSelection(sel, "sms", undefined, fetchReturning(["x"]))
    expect(patch.segment_id).toBeNull()
    expect(patch.audience_definition).toEqual(PRESET_DEF)
    expect(patch.buyer_ids).toEqual(["x"])
  })

  test("saved-segment selection → segment_id set, audience_definition null", async () => {
    h.segments = [{ id: "seg-9", definition: PRESET_DEF }]
    const sel: AudienceSelection = { kind: "segment", segmentId: "seg-9" }
    const patch = await resolveAudienceSelection(sel, "email", "camp-1", fetchReturning(["a", "b", "c"]))

    expect(patch.segment_id).toBe("seg-9")
    expect(patch.audience_definition).toBeNull()
    expect(patch.audience_preview_count).toBe(3)
  })

  test("sends channel + contextCampaignId to the resolve endpoint", async () => {
    const fetchImpl = fetchReturning(["a"])
    const sel: AudienceSelection = { kind: "preset", presetId: "clicked_last", definition: PRESET_DEF }
    await resolveAudienceSelection(sel, "sms", "camp-42", fetchImpl)

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe("/api/segments/resolve")
    const sent = JSON.parse((init as any).body)
    expect(sent.channel).toBe("sms")
    expect(sent.contextCampaignId).toBe("camp-42")
    expect(sent.definition).toEqual(PRESET_DEF)
  })
})

describe("campaign PATCH allowlist", () => {
  test("includes the audience provenance keys", () => {
    const src = readFileSync(path.join(process.cwd(), "app/api/campaigns/[id]/route.ts"), "utf8")
    expect(src).toContain('"segment_id"')
    expect(src).toContain('"audience_definition"')
    expect(src).toContain('"audience_preview_count"')
  })
})
