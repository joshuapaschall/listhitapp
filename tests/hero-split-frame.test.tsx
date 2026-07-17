/** @jest-environment jsdom */
import { render } from "@testing-library/react"
import { vi } from "vitest"
import { siteConfig } from "../lib/site-builder/blocks/config"
import { PHOTO_FRAME_W, PHOTO_FRAME_H } from "@/lib/site-builder/image-frame"

// LeadForm (rendered by the split variant) calls useRouter, which throws outside
// an App Router tree. useSiteForm resolves via DEFAULT_FORM_CONTEXT with no provider.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

const SUPA_URL = "https://x.supabase.co/storage/v1/object/public/property-images/hero.jpg"

function renderSplit(extra: Record<string, unknown> = {}) {
  const el = (siteConfig as { components: { Hero: { render: (p: unknown) => JSX.Element } } }).components.Hero.render({
    variant: "split",
    eyebrow: "Eyebrow",
    headline: "Headline",
    subhead: "Subhead",
    imageUrl: SUPA_URL,
    formTitle: "Get started",
    formSubtitle: "Sub",
    ctaLabel: "Go",
    ...extra,
  })
  return render(el)
}

describe("Hero split variant frame", () => {
  test("wrapper is the shared 4:3 ratio, not a fixed min-height", () => {
    const { container } = renderSplit()
    const img = container.querySelector("img") as HTMLImageElement
    expect(img).toBeTruthy()

    const wrapper = img.parentElement as HTMLElement
    const wrapStyle = wrapper.getAttribute("style") || ""
    expect(wrapStyle).toContain("aspect-ratio")
    expect(wrapStyle).not.toContain("min-height")
  })

  test("the image carries no min-height either", () => {
    const { container } = renderSplit()
    const img = container.querySelector("img") as HTMLImageElement
    expect((img.getAttribute("style") || "")).not.toContain("min-height")
  })

  test("the image absolutely fills and covers (not contain)", () => {
    const { container } = renderSplit()
    const img = container.querySelector("img") as HTMLImageElement
    const style = img.getAttribute("style") || ""
    expect(img.style.position).toBe("absolute")
    expect(style).toContain("inset")
    expect(img.style.objectFit).toBe("cover")
    expect(img.style.objectFit).not.toBe("contain")
  })

  test("sizes targets the image column, not the form column", () => {
    const { container } = renderSplit()
    const img = container.querySelector("img") as HTMLImageElement
    const sizes = img.getAttribute("sizes") || ""
    expect(sizes).toContain("660px")
    expect(sizes).not.toContain("400px")
  })

  test("intrinsic attrs match the frame ratio (CLS contract)", () => {
    const { container } = renderSplit()
    const img = container.querySelector("img") as HTMLImageElement
    expect(img.getAttribute("width")).toBe("800")
    expect(img.getAttribute("height")).toBe("600")
    expect(Number(img.getAttribute("width")) / Number(img.getAttribute("height"))).toBe(
      PHOTO_FRAME_W / PHOTO_FRAME_H,
    )
  })

  test("the stat chip still renders over the same frame", () => {
    const { container, getByText } = renderSplit({ stat: "7 years in business" })
    const img = container.querySelector("img") as HTMLImageElement
    const wrapper = img.parentElement as HTMLElement
    const chip = getByText("7 years in business")
    expect(wrapper.contains(chip)).toBe(true)
  })
})
