/** @jest-environment jsdom */
import { useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import ConditionRow from "../../components/segments/condition-row"
import type { BehavioralCondition, SegmentCondition } from "../../lib/segments/types"

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

let lastCond: SegmentCondition | null = null

function Harness({
  initial,
  channel = "email",
  allowThisCampaign = false,
}: {
  initial: BehavioralCondition
  channel?: "email" | "sms" | "both"
  allowThisCampaign?: boolean
}) {
  const [cond, setCond] = useState<SegmentCondition>(initial)
  lastCond = cond
  return (
    <ConditionRow
      condition={cond}
      channel={channel}
      allowThisCampaign={allowThisCampaign}
      onChange={(c) => {
        lastCond = c
        setCond(c)
      }}
      onRemove={() => {}}
    />
  )
}

function openByValue(text: string) {
  const trigger = screen.getByText(text).closest('[role="combobox"]') as HTMLElement
  trigger.focus()
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" })
  return screen.findAllByRole("option")
}

async function selectOption(triggerText: string, optionText: string) {
  const options = await openByValue(triggerText)
  const opt = options.find((o) => o.textContent?.trim() === optionText)
  if (!opt) throw new Error(`option "${optionText}" not found among: ${options.map((o) => o.textContent).join(" | ")}`)
  fireEvent.click(opt)
}

const optionTexts = (opts: HTMLElement[]) => opts.map((o) => o.textContent?.trim() ?? "")

beforeEach(() => {
  lastCond = null
})

describe("ConditionRow — last_n_campaigns scope", () => {
  test("offers 'any of the last N campaigns' as a scope option", async () => {
    render(<Harness initial={{ kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "any_campaign" } }} />)
    const texts = optionTexts(await openByValue("any campaign"))
    expect(texts).toContain("any of the last N campaigns")
  })

  test("renders the n input when scope is last_n_campaigns and edits write {type,n}", () => {
    render(
      <Harness initial={{ kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "last_n_campaigns", n: 5 } }} />,
    )
    const input = screen.getByRole("spinbutton") as HTMLInputElement
    expect(input.value).toBe("5")
    fireEvent.change(input, { target: { value: "3" } })
    expect(lastCond).toEqual(
      expect.objectContaining({ scope: { type: "last_n_campaigns", n: 3 } }),
    )
  })

  test("selecting the scope writes a last_n_campaigns scope", async () => {
    render(<Harness initial={{ kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "any_campaign" } }} />)
    await selectOption("any campaign", "any of the last N campaigns")
    expect((lastCond as BehavioralCondition).scope).toEqual({ type: "last_n_campaigns", n: 5 })
  })
})

describe("ConditionRow — this_campaign gating", () => {
  test("'this campaign' absent when allowThisCampaign is false", async () => {
    render(<Harness initial={{ kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "any_campaign" } }} allowThisCampaign={false} />)
    const texts = optionTexts(await openByValue("any campaign"))
    expect(texts).not.toContain("this campaign")
  })

  test("'this campaign' present when allowThisCampaign is true", async () => {
    render(<Harness initial={{ kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "any_campaign" } }} allowThisCampaign={true} />)
    const texts = optionTexts(await openByValue("any campaign"))
    expect(texts).toContain("this campaign")
  })
})

describe("ConditionRow — channel override", () => {
  test("writes cond.channel and 'This channel' clears it", async () => {
    // both-channel builder → override is shown; defaults to "This channel" (unset).
    render(<Harness initial={{ kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "any_campaign" } }} channel="both" />)
    expect(screen.getByText("This channel")).toBeTruthy()

    await selectOption("This channel", "Any channel")
    expect((lastCond as BehavioralCondition).channel).toBe("any")

    await selectOption("Any channel", "This channel")
    expect((lastCond as BehavioralCondition).channel).toBeUndefined()
  })

  test("override is hidden for a single-channel builder + single-channel metric", () => {
    // email builder + opened (email-only) → nothing to override.
    render(<Harness initial={{ kind: "behavioral", metric: "opened", operator: "did", scope: { type: "any_campaign" } }} channel="email" />)
    expect(screen.queryByText("This channel")).toBeNull()
  })
})
