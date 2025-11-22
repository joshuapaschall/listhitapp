import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/media/convert/route"
import { MEDIA_BUCKET } from "../utils/uploadMedia"

jest.mock("fluent-ffmpeg", () => {
  const ffmpeg = jest.fn(() => {
    const stream = new (require("stream")).PassThrough()
    const callbacks: Record<string, () => void> = {}
    const instance: any = {
      inputFormat: () => instance,
      audioBitrate: () => instance,
      audioChannels: () => instance,
      toFormat: () => instance,
      on: (e: string, cb: () => void) => {
        callbacks[e] = cb
        return instance
      },
      pipe: () => {
        process.nextTick(() => {
          stream.emit("data", Buffer.from("mp3"))
          stream.end()
          callbacks["end"]?.()
        })
        return stream
      },
    }
    return instance
  })
  ffmpeg.setFfmpegPath = jest.fn()
  return { __esModule: true, default: ffmpeg }
})

const fetchMock = jest.fn()
const uploadMock = jest.fn().mockResolvedValue({ data: { path: "file.mp3" }, error: null })
const removeMock = jest.fn().mockResolvedValue({ data: null, error: null })

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
    fetchMock.mockReset()
    uploadMock.mockClear()
    removeMock.mockClear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cdn"
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
    const res = await POST(req)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(uploadMock).toHaveBeenCalled()
    expect(removeMock).toHaveBeenCalledWith(["incoming/test.webm"])
    const body = await res.json()
    expect(body.url).toBe("https://cdn/storage/v1/object/public/public-media/file.mp3")
  })

  test("returns error when conversion fails", async () => {
    const spy = jest
      .spyOn(require("../utils/audio-utils"), "convertToMp3")
      .mockRejectedValueOnce(new Error("Converted audio exceeds the 1MB MMS limit"))
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ url: "https://cdn/audio.weba" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Converted audio exceeds the 1MB MMS limit")
    spy.mockRestore()
  })
})
