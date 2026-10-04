// Storage keys are validated server-side against
// /^(incoming|outgoing)\/[A-Za-z0-9._-]+$/, so the extension has to survive
// file names with spaces, punctuation, or no dot at all.

import { safeExtension } from "@/utils/uploadMedia"

describe("safeExtension", () => {
  test("lowercases the extension from the name", () => {
    expect(safeExtension("photo.JPG")).toBe("jpg")
  })

  test("falls back to the MIME subtype when the name has no dot", () => {
    expect(safeExtension("My Document", "application/pdf")).toBe("pdf")
  })

  test("strips non-alphanumerics from the extension", () => {
    expect(safeExtension("weird.na me!")).toBe("name")
  })

  test("returns bin with no usable name and no MIME", () => {
    expect(safeExtension("")).toBe("bin")
    expect(safeExtension("noextension")).toBe("bin")
  })

  test("uses the MIME subtype when the dotted extension sanitizes to nothing", () => {
    expect(safeExtension("archive.!!!", "image/png")).toBe("png")
  })

  test("ignores MIME parameters and caps the length", () => {
    expect(safeExtension("clip", "audio/mpeg; codecs=mp3")).toBe("mpeg")
    expect(safeExtension("f.abcdefghijklmnop")).toBe("abcdefghij")
  })
})
