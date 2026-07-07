import { describe, expect, it } from "vitest"
import { shortLinkLength, sampleShortUrl, applyShortLinkPreview } from "@/lib/shortlink-preview"

describe("shortlink-preview", () => {
  const domain = "go.georgiawholesalehomes.com" // 28 chars

  it("computes deterministic short link length (domain + 16)", () => {
    expect(shortLinkLength(domain, 7)).toBe(domain.length + 16)
    expect(sampleShortUrl(domain, 7)).toHaveLength(shortLinkLength(domain, 7))
  })

  it("replaces every URL with a length-accurate sample and reports savings", () => {
    const url = "https://georgiawholesalehomes.com/properties/876-plainville-place-southwest-atlanta-ga-30331"
    const msg = `Pics: ${url}\nReply STOP to opt out`
    const out = applyShortLinkPreview(msg, domain, 7)
    expect(out.urlCount).toBe(1)
    expect(out.effective).not.toContain(url)
    expect(out.effective).toContain(sampleShortUrl(domain, 7))
    expect(out.charsSaved).toBe(url.length - shortLinkLength(domain, 7))
  })

  it("is a no-op when there is no URL or no domain", () => {
    expect(applyShortLinkPreview("no links here", domain).urlCount).toBe(0)
    expect(applyShortLinkPreview("https://x.com/a", "").urlCount).toBe(0)
  })
})
