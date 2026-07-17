// Runs in the node environment (default for *.test.ts): node's File/Blob implement
// slice().arrayBuffer(), which the ftyp magic-byte sniff depends on. jsdom's Blob
// throws on arrayBuffer(), so we stub the DOM bits (document/canvas/createImageBitmap)
// the encode pipeline needs.
import {
  isHeic,
  normalizeImageFile,
  normalizeImageFiles,
  MAX_INPUT_BYTES,
} from "@/lib/images/normalize-image"

// heic2any is loaded via dynamic import inside the HEIC branch; mock it to return a JPEG blob.
vi.mock("heic2any", () => ({
  default: vi.fn(async () => new Blob(["jpeg-bytes"], { type: "image/jpeg" })),
}))

function iso(brand: string, name = "photo.img"): File {
  const bytes = new Uint8Array(32)
  const put = (s: string, at: number) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i)
  }
  put("ftyp", 4)
  put(brand, 8)
  return new File([bytes], name, { type: "" })
}

function oversized(): File {
  const f = new File([new Uint8Array(8)], "huge.jpg", { type: "image/jpeg" })
  Object.defineProperty(f, "size", { value: MAX_INPUT_BYTES + 1 })
  return f
}

function goodJpeg(name = "shot.jpg"): File {
  // 32-byte non-ftyp buffer so isHeic returns false, typed image/jpeg.
  const bytes = new Uint8Array(32)
  bytes[0] = 0xff
  bytes[1] = 0xd8
  bytes[2] = 0xff
  return new File([bytes], name, { type: "image/jpeg" })
}

beforeAll(() => {
  ;(globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = vi.fn(async () => ({
    width: 4000,
    height: 3000,
    close: vi.fn(),
  }))
  const makeCanvas = () => ({
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: () => {} }),
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob([new Uint8Array(1024)], { type: "image/jpeg" })),
  })
  ;(globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => (tag === "canvas" ? makeCanvas() : {}),
  }
})

describe("isHeic", () => {
  test("true for an ftyp/heic ISO-BMFF header", async () => {
    expect(await isHeic(iso("heic"))).toBe(true)
  })

  test("true for the generic HEIF brand mif1", async () => {
    expect(await isHeic(iso("mif1"))).toBe(true)
  })

  test("false for a JPEG magic-byte header", async () => {
    expect(await isHeic(goodJpeg())).toBe(false)
  })
})

describe("normalizeImageFile", () => {
  test("rejects a file larger than MAX_INPUT_BYTES", async () => {
    const result = await normalizeImageFile(oversized())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/40MB/)
  })

  test("rejects an unsupported type", async () => {
    const pdf = new File([new Uint8Array([1, 2, 3])], "doc.pdf", { type: "application/pdf" })
    const result = await normalizeImageFile(pdf)
    expect(result.ok).toBe(false)
  })

  test("converts a .heic input to a .jpg / image/jpeg File", async () => {
    const result = await normalizeImageFile(iso("heic", "photo.heic"))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.file.name.endsWith(".jpg")).toBe(true)
      expect(result.file.type).toBe("image/jpeg")
      expect(result.converted).toBe(true)
    }
  })
})

describe("normalizeImageFiles", () => {
  test("returns partial success — good file kept, bad file reported", async () => {
    const bad = oversized()
    const { files, errors } = await normalizeImageFiles([goodJpeg(), bad])
    expect(files).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].startsWith(bad.name)).toBe(true)
  })
})
