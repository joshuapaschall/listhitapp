/** @jest-environment jsdom */
import { render, fireEvent } from "@testing-library/react"
import { DealCard } from "../components/sites/deal-card"
import { PropertyGallery } from "../components/sites/property-gallery"
import {
  PHOTO_FRAME_RATIO,
  PHOTO_FRAME_W,
  PHOTO_FRAME_H,
  frameHeight,
} from "@/lib/site-builder/image-frame"

const SUPA_URL = "https://x.supabase.co/storage/v1/object/public/property-images/a.jpg"
const SUPA_URL2 = "https://x.supabase.co/storage/v1/object/public/property-images/b.jpg"

const property = {
  id: "p1",
  slug: "123-main-st",
  address: "123 Main St",
  city: "Austin",
  state: "TX",
  price: 250000,
  bedrooms: 3,
  bathrooms: 2,
  sqft: 1800,
  property_type: "Single Family",
  primary_image_url: SUPA_URL,
  deal_type: "cash",
  finance_subtype: null,
  condition: null,
  occupancy: null,
}

describe("image-frame constants", () => {
  test("frameHeight math is 4:3", () => {
    expect(frameHeight(96)).toBe(72)
    expect(frameHeight(400)).toBe(300)
    expect(frameHeight(342)).toBe(257)
  })

  test("PHOTO_FRAME_RATIO is 4:3 and the numeric constants agree", () => {
    expect(PHOTO_FRAME_RATIO).toBe("4 / 3")
    expect(PHOTO_FRAME_W / PHOTO_FRAME_H).toBe(4 / 3)
  })
})

describe("DealCard framing", () => {
  test("frames at the ratio, never a fixed height; image covers", () => {
    const { container } = render(<DealCard property={property} />)
    const img = container.querySelector("img") as HTMLImageElement
    expect(img).toBeTruthy()

    const frame = img.parentElement as HTMLElement
    const frameStyle = frame.getAttribute("style") || ""
    expect(frameStyle).toContain("aspect-ratio")
    expect(frameStyle).not.toContain("height: 150px")

    expect(img.style.objectFit).toBe("cover")
    expect(img.style.objectFit).not.toBe("contain")
  })
})

describe("PropertyGallery hero", () => {
  // jsdom implements neither of these — the strip effect and any smooth scroll need them.
  const scrollToMock = vi.fn()
  beforeAll(() => {
    HTMLElement.prototype.scrollTo = scrollToMock as unknown as typeof HTMLElement.prototype.scrollTo
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  })
  beforeEach(() => {
    scrollToMock.mockClear()
    document.body.style.overflow = ""
  })

  const openLightbox = (container: HTMLElement) => {
    const heroBtn = container.querySelector('[aria-label="View photo larger"]') as HTMLElement
    fireEvent.click(heroBtn)
  }
  const dialog = () => document.querySelector('[role="dialog"]')
  const dialogImgSrc = () => (document.querySelector('[role="dialog"] img') as HTMLImageElement | null)?.getAttribute("src") || ""

  test("renders a single contained photo with no blurred backdrop", () => {
    const { container } = render(<PropertyGallery images={[{ image_url: SUPA_URL }]} alt="test" />)
    const imgs = container.querySelectorAll("img")
    // The blurred backdrop was removed — one photo, one <img>.
    expect(imgs).toHaveLength(1)

    const hero = imgs[0] as HTMLImageElement
    expect(hero.getAttribute("alt")).toBe("test")
    expect(hero.style.objectFit).toBe("contain")
    expect(hero.style.objectFit).not.toBe("cover")
    expect(hero.style.filter || "").not.toContain("blur(")
  })

  test("the hero requests the full-size image with a srcset (no tiny backdrop)", () => {
    const { container } = render(<PropertyGallery images={[{ image_url: SUPA_URL }]} alt="test" />)
    const hero = container.querySelector("img") as HTMLImageElement

    const src = hero.getAttribute("src") || ""
    expect(src).toContain("width=1280")
    expect(src).not.toContain("width=64")
    expect(hero.hasAttribute("srcset")).toBe(true)
  })

  test("empty gallery still renders a 4:3 frame", () => {
    const { container } = render(<PropertyGallery images={[]} alt="test" />)
    const el = container.firstChild as HTMLElement
    const style = el.getAttribute("style") || ""
    expect(style).toContain("aspect-ratio")
    expect(style).not.toContain("16 / 10")
  })

  test("lightbox is closed by default", () => {
    render(<PropertyGallery images={[{ image_url: SUPA_URL }]} alt="test" />)
    expect(dialog()).toBeNull()
  })

  test("clicking the hero opens the lightbox", () => {
    const { container } = render(<PropertyGallery images={[{ image_url: SUPA_URL }]} alt="test" />)
    openLightbox(container)
    expect(dialog()).not.toBeNull()
  })

  test("Escape closes the lightbox", () => {
    const { container } = render(<PropertyGallery images={[{ image_url: SUPA_URL }]} alt="test" />)
    openLightbox(container)
    expect(dialog()).not.toBeNull()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(dialog()).toBeNull()
  })

  test("arrow keys navigate to the next photo", () => {
    const { container } = render(
      <PropertyGallery images={[{ image_url: SUPA_URL }, { image_url: SUPA_URL2 }]} alt="test" />,
    )
    openLightbox(container)
    expect(dialogImgSrc()).toContain("a.jpg")
    fireEvent.keyDown(document, { key: "ArrowRight" })
    expect(dialogImgSrc()).toContain("b.jpg")
  })

  test("body scroll is locked while open and the prior value is restored on close", () => {
    document.body.style.overflow = "scroll"
    const { container } = render(<PropertyGallery images={[{ image_url: SUPA_URL }]} alt="test" />)
    openLightbox(container)
    expect(document.body.style.overflow).toBe("hidden")
    fireEvent.keyDown(document, { key: "Escape" })
    expect(document.body.style.overflow).toBe("scroll")
  })

  test("navigation wraps from the last photo to the first", () => {
    const { container } = render(
      <PropertyGallery images={[{ image_url: SUPA_URL }, { image_url: SUPA_URL2 }]} alt="test" />,
    )
    // Select the last thumbnail, then open on it.
    fireEvent.click(container.querySelector('[aria-label="View photo 2"]') as HTMLElement)
    openLightbox(container)
    expect(dialogImgSrc()).toContain("b.jpg")
    fireEvent.keyDown(document, { key: "ArrowRight" })
    expect(dialogImgSrc()).toContain("a.jpg")
  })

  test("the strip effect scrolls with a left clamped to >= 0", () => {
    render(<PropertyGallery images={[{ image_url: SUPA_URL }, { image_url: SUPA_URL2 }]} alt="test" />)
    expect(scrollToMock).toHaveBeenCalled()
    const arg = scrollToMock.mock.calls[0][0] as { left: number }
    expect(arg.left).toBeGreaterThanOrEqual(0)
  })
})
