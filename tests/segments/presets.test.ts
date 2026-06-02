import { CORE_PRESETS, OPTIONAL_PRESETS, presetsForChannel } from "@/lib/segments/presets"
import { validateDefinition } from "@/lib/segments/resolver"
import type { BehavioralCondition } from "@/lib/segments/types"

describe("segment presets", () => {
  test("every CORE preset builds a definition that passes validateDefinition", () => {
    for (const preset of CORE_PRESETS) {
      expect(() => validateDefinition(preset.build({ contextCampaignId: "c-1" }))).not.toThrow()
    }
  })

  test("every OPTIONAL preset builds a definition that passes validateDefinition", () => {
    for (const preset of OPTIONAL_PRESETS) {
      expect(() => validateDefinition(preset.build({ contextCampaignId: "c-1" }))).not.toThrow()
    }
  })

  test("everyone_reachable is an empty definition", () => {
    const def = CORE_PRESETS.find((p) => p.id === "everyone_reachable")!.build()
    expect(def.conditions).toEqual([])
  })

  test("didnt_open_last is email-only, last_n_campaigns n:1, with no explicit cond.channel", () => {
    const preset = CORE_PRESETS.find((p) => p.id === "didnt_open_last")!
    expect(preset.channels).toEqual(["email"])
    const cond = preset.build().conditions[0] as BehavioralCondition
    expect(cond.kind).toBe("behavioral")
    expect(cond.metric).toBe("opened")
    expect(cond.operator).toBe("did_not")
    expect(cond.scope).toEqual({ type: "last_n_campaigns", n: 1 })
    expect(cond.channel).toBeUndefined() // inherits channel-locking from the engine
  })

  test("CORE_PRESETS is exactly the six behavioral presets", () => {
    expect(CORE_PRESETS.map((p) => p.id)).toEqual([
      "everyone_reachable",
      "didnt_open_last",
      "opened_last",
      "clicked_last",
      "didnt_click_last",
      "didnt_reply_last",
    ])
  })

  test("new_buyers_30d uses created_at within_days (now an OPTIONAL preset)", () => {
    const def = OPTIONAL_PRESETS.find((p) => p.id === "new_buyers_30d")!.build()
    expect(def.conditions[0]).toEqual({
      kind: "attribute",
      field: "created_at",
      operator: "within_days",
      value: { days: 30 },
    })
  })

  test("presetsForChannel surfaces the right behavioral set per channel", () => {
    expect(presetsForChannel("email").map((p) => p.id)).toEqual([
      "everyone_reachable",
      "didnt_open_last",
      "opened_last",
      "clicked_last",
      "didnt_click_last",
    ])
    expect(presetsForChannel("sms").map((p) => p.id)).toEqual([
      "everyone_reachable",
      "clicked_last",
      "didnt_click_last",
      "didnt_reply_last",
    ])
  })

  test("presetsForChannel channel-filters core presets", () => {
    const sms = presetsForChannel("sms").map((p) => p.id)
    const email = presetsForChannel("email").map((p) => p.id)

    // email-only excluded from sms, sms-only excluded from email
    expect(sms).not.toContain("didnt_open_last")
    expect(sms).not.toContain("opened_last")
    expect(sms).toContain("didnt_reply_last")
    expect(email).not.toContain("didnt_reply_last")
    expect(email).toContain("didnt_open_last")

    // both-channel presets appear on both
    expect(sms).toContain("everyone_reachable")
    expect(email).toContain("everyone_reachable")
    expect(sms).toContain("clicked_last")
    expect(email).toContain("clicked_last")
  })
})
