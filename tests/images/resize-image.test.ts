import { describe, expect, test } from "vitest"
import { shouldResize, resizeImageFile } from "@/lib/images/resize-image"

// canvas / createImageBitmap aren't available in the test env, so we exercise
// the pure decision logic + the passthrough paths (which never touch canvas).
const fakeFile = (type: string, size: number, name = "photo"): File =>
  ({ type, size, name }) as unknown as File

describe("shouldResize", () => {
  test("non-image passes through (false)", () => {
    expect(shouldResize(fakeFile("application/pdf", 5_000_000))).toBe(false)
  })
  test("GIF passes through to preserve animation (false)", () => {
    expect(shouldResize(fakeFile("image/gif", 5_000_000))).toBe(false)
  })
  test("image already under target passes through (false)", () => {
    expect(shouldResize(fakeFile("image/jpeg", 500_000))).toBe(false)
  })
  test("oversized image should resize (true)", () => {
    expect(shouldResize(fakeFile("image/png", 4_000_000))).toBe(true)
  })
  test("custom target byte ceiling is honored", () => {
    expect(shouldResize(fakeFile("image/jpeg", 600_000), 500_000)).toBe(true)
    expect(shouldResize(fakeFile("image/jpeg", 400_000), 500_000)).toBe(false)
  })
})

describe("resizeImageFile passthrough (no canvas needed)", () => {
  test("returns the same File for a non-image", async () => {
    const f = fakeFile("application/pdf", 9_000_000)
    expect(await resizeImageFile(f)).toBe(f)
  })
  test("returns the same File for a GIF", async () => {
    const f = fakeFile("image/gif", 9_000_000)
    expect(await resizeImageFile(f)).toBe(f)
  })
  test("returns the same File for an already-small image", async () => {
    const f = fakeFile("image/jpeg", 100_000)
    expect(await resizeImageFile(f)).toBe(f)
  })
})
