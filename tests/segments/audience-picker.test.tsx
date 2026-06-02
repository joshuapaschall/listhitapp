/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import AudiencePicker from "../../components/segments/audience-picker"
import type { AudienceSelection } from "../../lib/segments/audience"

const h = vi.hoisted(() => ({
  segments: [] as any[],
  created: { id: "new-seg" } as any,
  createSpy: null as any,
}))

vi.mock("@/services/segment-service", () => {
  const EMPTY_DEFINITION = { match: "all", conditions: [] }
  h.createSpy = vi.fn(async (input: any) => ({ id: h.created.id, ...input }))
  return {
    EMPTY_DEFINITION,
    SegmentService: {
      listSegments: async () => h.segments,
      getSegment: async (id: string) => h.segments.find((s) => s.id === id) ?? null,
      createSegment: h.createSpy,
    },
  }
})

// supabase + fetch used transitively by the builder / count badge.
vi.mock("@/lib/supabase", () => {
  const b: any = {
    select: () => b, eq: () => b, is: () => b, order: () => b, limit: () => b,
    ilike: () => b, not: () => b, in: () => b, then: (r: any) => r({ data: [], error: null }),
  }
  return { supabase: { from: () => b } }
})

beforeAll(() => {
  if (!(global as any).PointerEvent) (global as any).PointerEvent = class extends MouseEvent {} as any
  Element.prototype.hasPointerCapture = vi.fn(() => false) as any
  Element.prototype.setPointerCapture = vi.fn() as any
  Element.prototype.releasePointerCapture = vi.fn() as any
  Element.prototype.scrollIntoView = vi.fn() as any
  ;(global as any).fetch = vi.fn(async () => ({ ok: true, json: async () => ({ count: 0 }) })) as any
})

beforeEach(() => {
  h.segments = []
  h.created = { id: "new-seg" }
  h.createSpy?.mockClear()
})

describe("AudiencePicker", () => {
  test("renders channel-filtered presets and a build-custom action", async () => {
    render(<AudiencePicker channel="email" value={null} onChange={() => {}} />)
    expect(await screen.findByText("Didn't open last")).toBeTruthy()
    expect(screen.getByText("Everyone reachable")).toBeTruthy()
    expect(screen.getByText("Build a custom segment")).toBeTruthy()
  })

  test("SMS picker hides email-only presets and shows sms-only ones", async () => {
    render(<AudiencePicker channel="sms" value={null} onChange={() => {}} />)
    await screen.findByText("Everyone reachable")
    expect(screen.queryByText("Didn't open last")).toBeNull()
    expect(screen.getByText("Didn't reply last")).toBeTruthy()
  })

  test("tapping a preset emits a preset selection", async () => {
    let sel: AudienceSelection | null = null
    render(<AudiencePicker channel="email" value={null} onChange={(s) => (sel = s)} />)
    fireEvent.click(await screen.findByText("Clicked last"))
    expect(sel).toMatchObject({ kind: "preset", presetId: "clicked_last" })
    expect((sel as any).definition.conditions[0]).toMatchObject({ metric: "clicked", operator: "did" })
  })

  test("renders saved segments usable on the channel and emits a segment selection when tapped", async () => {
    h.segments = [
      { id: "s1", name: "VIPs", channel: null, definition: { match: "all", conditions: [] } },
      { id: "s2", name: "SMS only", channel: "sms", definition: { match: "all", conditions: [] } },
    ]
    let sel: AudienceSelection | null = null
    render(<AudiencePicker channel="email" value={null} onChange={(s) => (sel = s)} />)
    const vip = await screen.findByText("VIPs")
    // s2 is sms-only → hidden on the email picker
    expect(screen.queryByText("SMS only")).toBeNull()
    fireEvent.click(vip)
    expect(sel).toEqual({ kind: "segment", segmentId: "s1" })
  })

  test("build-custom with 'save for reuse' + name routes through createSegment → segment selection", async () => {
    let sel: AudienceSelection | null = null
    render(<AudiencePicker channel="email" value={null} onChange={(s) => (sel = s)} />)
    fireEvent.click(await screen.findByText("Build a custom segment"))

    const toggle = await screen.findByRole("switch")
    fireEvent.click(toggle)
    fireEvent.change(await screen.findByPlaceholderText("Segment name"), { target: { value: "My segment" } })
    fireEvent.click(screen.getByText("Save & use"))

    await waitFor(() => expect(h.createSpy).toHaveBeenCalled())
    expect(h.createSpy.mock.calls[0][0]).toMatchObject({ name: "My segment", channel: "email" })
    await waitFor(() => expect(sel).toEqual({ kind: "segment", segmentId: "new-seg" }))
  })

  test("build-custom without a name emits an inline selection", async () => {
    let sel: AudienceSelection | null = null
    render(<AudiencePicker channel="email" value={null} onChange={(s) => (sel = s)} />)
    fireEvent.click(await screen.findByText("Build a custom segment"))
    fireEvent.click(await screen.findByText("Use audience"))
    expect(h.createSpy).not.toHaveBeenCalled()
    expect((sel as any)?.kind).toBe("inline")
  })
})
