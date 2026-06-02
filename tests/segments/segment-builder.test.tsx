/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react"
import ConditionRow from "../../components/segments/condition-row"
import type { AttributeCondition, BehavioralCondition } from "../../lib/segments/types"

// TagSelector / count badge hit supabase + fetch; stub both so the builder is
// deterministic and offline.
vi.mock("@/lib/supabase", () => {
  const b: any = {
    select: () => b,
    eq: () => b,
    is: () => b,
    order: () => b,
    limit: () => b,
    ilike: () => b,
    not: () => b,
    in: () => b,
    then: (resolve: any) => resolve({ data: [], error: null }),
  }
  return { supabase: { from: () => b } }
})

beforeAll(() => {
  if (!(global as any).PointerEvent) {
    ;(global as any).PointerEvent = class extends MouseEvent {} as any
  }
  Element.prototype.hasPointerCapture = vi.fn(() => false) as any
  Element.prototype.setPointerCapture = vi.fn() as any
  Element.prototype.releasePointerCapture = vi.fn() as any
  Element.prototype.scrollIntoView = vi.fn() as any
  ;(global as any).fetch = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => (String(url).includes("preview") ? { count: 0 } : { options: [] }),
  })) as any
})

const noop = () => {}

// Open a Radix Select by focusing the trigger that currently shows `text` and
// pressing ArrowDown (keyboard activation is reliable in jsdom; pointer events
// are not). Returns the option elements once they mount.
async function openByValue(text: string) {
  const el = screen.getByText(text)
  const trigger = el.closest('[role="combobox"]') as HTMLElement
  trigger.focus()
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" })
  return screen.findAllByRole("option")
}

const optionTexts = (options: HTMLElement[]) => options.map((o) => o.textContent?.trim() ?? "")

function renderRow(condition: AttributeCondition | BehavioralCondition, opts: { channel?: "email" | "sms" | "both"; allowThisCampaign?: boolean } = {}) {
  return render(
    <ConditionRow
      condition={condition}
      channel={opts.channel ?? "email"}
      allowThisCampaign={opts.allowThisCampaign}
      onChange={noop}
      onRemove={noop}
    />,
  )
}

describe("SegmentBuilder (catalog-driven)", () => {
  test("a text[] field (tags) renders a multiselect input", () => {
    renderRow({ kind: "attribute", field: "tags", operator: "contains", value: [] })
    expect(screen.getByPlaceholderText(/search tags/i)).toBeTruthy()
  })

  test("a boolean field renders is/is-not with no value box", () => {
    renderRow({ kind: "attribute", field: "vip", operator: "is", value: true })
    // No value input is rendered for booleans.
    expect(screen.queryByPlaceholderText("Value")).toBeNull()
    expect(screen.queryByRole("spinbutton")).toBeNull()
    // Operator value reflects "is".
    expect(screen.getByText("is")).toBeTruthy()
  })

  test("number between renders two inputs", () => {
    renderRow({ kind: "attribute", field: "score", operator: "between", value: {} })
    expect(screen.getByPlaceholderText("Min")).toBeTruthy()
    expect(screen.getByPlaceholderText("Max")).toBeTruthy()
  })

  test("selecting an attribute field renders only that field's operators", async () => {
    renderRow({ kind: "attribute", field: "score", operator: "gte", value: 0 })
    const texts = optionTexts(await openByValue("at least")) // score's default operator label
    // number operators present:
    expect(texts).toContain("between")
    expect(texts).toContain("at most")
    expect(texts).toContain("equals")
    // a text[]-only operator must NOT appear for a number field:
    expect(texts).not.toContain("includes any of")
  })

  test("a behavioral metric renders did/did-not and a scope control", async () => {
    renderRow({ kind: "behavioral", metric: "opened", operator: "did", scope: { type: "any_campaign" } })
    expect(screen.getByText("did")).toBeTruthy()
    expect(screen.getByText("any campaign")).toBeTruthy()
    const texts = optionTexts(await openByValue("did"))
    expect(texts).toContain("did not")
  })

  test("an email-only metric is disabled when channel is sms", async () => {
    renderRow(
      { kind: "behavioral", metric: "replied", operator: "did", scope: { type: "any_campaign" } },
      { channel: "sms" },
    )
    const options = await openByValue("replied")
    const opened = options.find((o) => /opened \(email only\)/i.test(o.textContent ?? ""))
    expect(opened).toBeTruthy()
    expect(opened?.getAttribute("aria-disabled")).toBe("true")
  })

  test("'this campaign' scope is absent when allowThisCampaign is false", async () => {
    renderRow(
      { kind: "behavioral", metric: "opened", operator: "did", scope: { type: "any_campaign" } },
      { channel: "email", allowThisCampaign: false },
    )
    const texts = optionTexts(await openByValue("any campaign"))
    expect(texts).toContain("a specific campaign")
    expect(texts).not.toContain("this campaign")
  })

  test("'this campaign' scope is present when allowThisCampaign is true", async () => {
    renderRow(
      { kind: "behavioral", metric: "opened", operator: "did", scope: { type: "any_campaign" } },
      { channel: "email", allowThisCampaign: true },
    )
    const texts = optionTexts(await openByValue("any campaign"))
    expect(texts).toContain("this campaign")
  })
})
