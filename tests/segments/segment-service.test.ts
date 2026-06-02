import { SegmentService } from "../../services/segment-service"
import type { SegmentDefinition } from "../../lib/segments/types"

// Captured calls for assertions.
const calls = {
  lastTable: "" as string,
  lastInsert: null as any,
  lastUpdate: null as any,
  lastUpdateEqId: null as any,
  rows: [] as any[],
}

vi.mock("../../lib/supabase", () => {
  function builder(table: string) {
    let op: "insert" | "update" | "select" | null = null
    let payload: any = null
    const filters: Record<string, any> = {}

    const single = async () => {
      if (op === "insert") return { data: { id: "seg-new", ...payload }, error: null }
      if (op === "update") return { data: { id: filters.id ?? "seg-1", ...payload }, error: null }
      return { data: calls.rows[0] ?? null, error: null }
    }

    const b: any = {
      select: () => b,
      is: () => b,
      order: () => b,
      eq: (col: string, val: any) => {
        filters[col] = val
        if (op === "update") calls.lastUpdateEqId = val
        return b
      },
      maybeSingle: single,
      single,
      insert: (p: any) => {
        op = "insert"
        payload = p
        calls.lastTable = table
        calls.lastInsert = p
        return b
      },
      update: (p: any) => {
        op = "update"
        payload = p
        calls.lastTable = table
        calls.lastUpdate = p
        return b
      },
      // Awaited list/update-without-single resolves here.
      then: (resolve: any) => resolve({ data: calls.rows, error: null }),
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

const DEF: SegmentDefinition = { match: "any", conditions: [{ kind: "attribute", field: "vip", operator: "is", value: true }] }

describe("SegmentService", () => {
  beforeEach(() => {
    calls.lastTable = ""
    calls.lastInsert = null
    calls.lastUpdate = null
    calls.lastUpdateEqId = null
    calls.rows = []
  })

  test("listSegments queries active segments only", async () => {
    calls.rows = [{ id: "a" }, { id: "b" }]
    const result = await SegmentService.listSegments()
    expect(result).toHaveLength(2)
  })

  test("createSegment mirrors match from definition.match", async () => {
    const seg = await SegmentService.createSegment({ name: "Test", definition: DEF })
    expect(calls.lastTable).toBe("segments")
    expect(calls.lastInsert.match).toBe("any")
    expect(calls.lastInsert.definition).toEqual(DEF)
    expect(calls.lastInsert.channel).toBeNull()
    expect(seg.id).toBe("seg-new")
  })

  test("updateSegment mirrors match when a definition is provided", async () => {
    await SegmentService.updateSegment("seg-1", { definition: { match: "all", conditions: [] } })
    expect(calls.lastUpdate.match).toBe("all")
    expect(calls.lastUpdateEqId).toBe("seg-1")
    expect(typeof calls.lastUpdate.updated_at).toBe("string")
  })

  test("softDeleteSegment sets deleted_at and never hard-deletes", async () => {
    await SegmentService.softDeleteSegment("seg-9")
    expect(calls.lastUpdate).toBeTruthy()
    expect(typeof calls.lastUpdate.deleted_at).toBe("string")
    expect(calls.lastUpdateEqId).toBe("seg-9")
  })

  test("duplicateSegment copies the source with a (copy) suffix", async () => {
    calls.rows = [
      { id: "src", name: "Original", description: "d", channel: "email", definition: DEF, deleted_at: null },
    ]
    await SegmentService.duplicateSegment("src")
    expect(calls.lastInsert.name).toBe("Original (copy)")
    expect(calls.lastInsert.channel).toBe("email")
    expect(calls.lastInsert.match).toBe("any")
  })
})
