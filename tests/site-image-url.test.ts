import { siteImage, siteSrcSet } from "@/lib/site-builder/image-url"

const SUPA = "https://x.supabase.co/storage/v1/object/public/property-images/a.jpg"
const UNSPLASH = "https://images.unsplash.com/photo-123?ixid=abc"
const EXTERNAL = "https://example.com/a.jpg"

describe("siteImage", () => {
  test("adds resize=contain so the CDN never crops", () => {
    const url = siteImage(SUPA, { width: 800 }) || ""
    expect(url).toContain("resize=contain")
  })

  test("rewrites /object/public/ to /render/image/public/", () => {
    const url = siteImage(SUPA, { width: 800 }) || ""
    expect(url).toContain("/storage/v1/render/image/public/")
    expect(url).not.toContain("/storage/v1/object/public/")
  })

  test("clamps width to Supabase's 2500 ceiling", () => {
    const url = siteImage(SUPA, { width: 2560 }) || ""
    expect(url).toContain("width=2500")
    expect(url).not.toContain("width=2560")
  })

  test("clamps a below-1 width up to 1", () => {
    const url = siteImage(SUPA, { width: 0 }) || ""
    expect(url).toContain("width=1")
  })

  test("returns a non-Supabase URL unchanged, with no resize appended", () => {
    const url = siteImage(EXTERNAL, { width: 800 })
    expect(url).toBe(EXTERNAL)
    expect(url).not.toContain("resize")
  })

  test("routes Unsplash through its own optimizer and never adds resize=contain", () => {
    const url = siteImage(UNSPLASH, { width: 800 }) || ""
    expect(url).toContain("w=800")
    expect(url).toContain("auto=format")
    expect(url).toMatch(/[?&]q=/)
    expect(url).not.toContain("resize=contain")
  })

  test("returns undefined for empty input", () => {
    expect(siteImage(null)).toBeUndefined()
    expect(siteImage("")).toBeUndefined()
  })
})

describe("siteSrcSet", () => {
  test("emits every candidate with resize=contain and correct width descriptors", () => {
    const srcset = siteSrcSet(SUPA, [800, 1280]) || ""
    const parts = srcset.split(", ")
    expect(parts).toHaveLength(2)
    for (const part of parts) {
      expect(part).toContain("resize=contain")
    }
    expect(srcset).toContain(" 800w")
    expect(srcset).toContain(" 1280w")
  })
})
