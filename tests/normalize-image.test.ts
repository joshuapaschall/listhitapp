// Runs in the node environment (default for *.test.ts): node's File/Blob implement
// slice().arrayBuffer(), which the ftyp magic-byte sniff depends on. jsdom's Blob
// throws on arrayBuffer(), so we stub the DOM bits (document/canvas/createImageBitmap)
// the encode pipeline needs.
import {
  isHeic,
  normalizeImageFile,
  normalizeImageFiles,
  MAX_INPUT_BYTES,
  MAX_OUTPUT_BYTES,
  MAX_EDGE,
} from "@/lib/images/normalize-image"

// Ordered record of 2D-context calls the encode pipeline makes, so tests can
// assert the white matte is filled *before* the source is drawn.
type CtxCall =
  | { kind: "fillStyle"; value: string }
  | { kind: "fillRect"; args: number[] }
  | { kind: "drawImage" }
const ctxCalls: CtxCall[] = []

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
  const makeCtx = () => {
    const ctx = {
      fillRect: (...args: number[]) => ctxCalls.push({ kind: "fillRect", args }),
      drawImage: () => ctxCalls.push({ kind: "drawImage" }),
    }
    let fill = ""
    Object.defineProperty(ctx, "fillStyle", {
      get: () => fill,
      set: (v: string) => {
        fill = v
        ctxCalls.push({ kind: "fillStyle", value: v })
      },
    })
    return ctx
  }
  const makeCanvas = () => ({
    width: 0,
    height: 0,
    getContext: () => makeCtx(),
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

describe("encodeJpeg white matting", () => {
  beforeEach(() => {
    ctxCalls.length = 0
  })

  test("fills white before drawing the source (transparent PNGs → white, not black)", async () => {
    // PNG signature, non-ftyp so isHeic is false; the 4000×3000 stub edge exceeds
    // MAX_EDGE, so it routes through the canvas rather than the JPEG short-circuit.
    const bytes = new Uint8Array(32)
    bytes[0] = 0x89
    bytes[1] = 0x50
    bytes[2] = 0x4e
    bytes[3] = 0x47
    const png = new File([bytes], "floor-plan.png", { type: "image/png" })

    const result = await normalizeImageFile(png)
    expect(result.ok).toBe(true)

    expect(ctxCalls.find((c) => c.kind === "fillStyle")).toEqual({ kind: "fillStyle", value: "#FFFFFF" })

    const fillRectIdx = ctxCalls.findIndex((c) => c.kind === "fillRect")
    const drawIdx = ctxCalls.findIndex((c) => c.kind === "drawImage")
    expect(fillRectIdx).toBeGreaterThanOrEqual(0)
    expect(drawIdx).toBeGreaterThanOrEqual(0)
    // The assertion that actually protects the fix: white matte fills BEFORE the draw.
    expect(fillRectIdx).toBeLessThan(drawIdx)

    const fillRect = ctxCalls[fillRectIdx]
    if (fillRect.kind === "fillRect") {
      // scale = MAX_EDGE / 4000; canvas = 2560 × 1920
      expect(fillRect.args).toEqual([0, 0, MAX_EDGE, Math.round(3000 * (MAX_EDGE / 4000))])
    }
  })

  test("short-circuited JPEGs never touch the canvas", async () => {
    // A bounded JPEG: decoded edge ≤ MAX_EDGE so the short-circuit returns the
    // original File without re-encoding.
    const cib = globalThis.createImageBitmap as unknown as ReturnType<typeof vi.fn>
    cib.mockResolvedValueOnce({ width: 800, height: 600, close: vi.fn() })

    const jpeg = goodJpeg("already-bounded.jpg")
    expect(jpeg.size).toBeLessThanOrEqual(MAX_OUTPUT_BYTES)

    const result = await normalizeImageFile(jpeg)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.file).toBe(jpeg)
      expect(result.converted).toBe(false)
    }
    expect(ctxCalls.some((c) => c.kind === "fillRect")).toBe(false)
    expect(ctxCalls.some((c) => c.kind === "drawImage")).toBe(false)
  })
})
