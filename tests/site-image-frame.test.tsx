/** @jest-environment jsdom */
import { render } from "@testing-library/react"
import { DealCard } from "../components/sites/deal-card"
import { PropertyGallery } from "../components/sites/property-gallery"
import {
  PHOTO_FRAME_RATIO,
  PHOTO_FRAME_W,
  PHOTO_FRAME_H,
  frameHeight,
} from "@/lib/site-builder/image-frame"

const SUPA_URL = "https://x.supabase.co/storage/v1/object/public/property-images/a.jpg"

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
})
