import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { MEDIA_BUCKET } from "../utils/uploadMedia"

const fetchMock = jest.fn()
const uploadMock = jest.fn().mockResolvedValue({ data: { path: "file.mp3" }, error: null })
const removeMock = jest.fn().mockResolvedValue({ data: null, error: null })
const mirrorMock = jest.fn(async (inputUrl: string) => {
  await uploadMock("file.mp3", Buffer.from("mp3"), {
    contentType: "audio/mpeg",
    upsert: true,
  })
  await removeMock([inputUrl.replace(`https://cdn/storage/v1/object/public/${MEDIA_BUCKET}/`, "")])
  return `https://cdn/storage/v1/object/public/${MEDIA_BUCKET}/file.mp3`
})

// @ts-ignore
global.fetch = fetchMock

jest.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: () => ({
          data: { publicUrl: "https://cdn/storage/v1/object/public/public-media/file.mp3" },
        }),
        remove: removeMock,
      }),
    },
  },
  supabase: {},
}))

describe("media convert route", () => {
  beforeEach(() => {
    jest.resetModules()
    fetchMock.mockReset()
    uploadMock.mockClear()
    removeMock.mockClear()
    mirrorMock.mockClear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cdn"
    process.env.MOCK_MIRROR_MEDIA = "true"
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("webm"),
      headers: { get: () => "audio/webm" },
    })
  })

  test("deletes original after conversion", async () => {
    const url = `https://cdn/storage/v1/object/public/${MEDIA_BUCKET}/incoming/test.webm`
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ url }),
    })
    let POST: any
    await jest.isolateModulesAsync(async () => {
      jest.doMock("../utils/mms.server", () => ({
        __esModule: true,
        mirrorMediaUrl: (...args: any[]) => mirrorMock(...args),
      }))
      const mod = await import("../app/api/media/convert/route")
      POST = mod.POST
    })
    const res = await POST(req)
    expect(fetchMock).toHaveBeenCalledTimes(0)
    const body = await res.json()
    expect(body.url).toBe("https://cdn/storage/v1/object/public/public-media/mock/test.mp3")
  })
})
