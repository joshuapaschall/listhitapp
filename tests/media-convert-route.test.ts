import { NextRequest } from "next/server"
import { POST } from "../app/api/media/convert/route"
import { MEDIA_BUCKET } from "../utils/uploadMedia"

vi.mock("fluent-ffmpeg", () => {
  const ffmpeg = vi.fn(() => {
    const callbacks: Record<string, (...args: any[]) => void> = {}
    const instance: any = {
      inputFormat: () => instance,
      audioBitrate: () => instance,
      audioChannels: () => instance,
      format: () => instance,
      toFormat: () => instance,
      on: (e: string, cb: (...args: any[]) => void) => {
        callbacks[e] = cb
        return instance
      },
      // The code does `command.pipe(new PassThrough())` and listens on the
      // OUTPUT stream — emit "data" then "end" on the passed-in output.
      pipe: (output: any) => {
        process.nextTick(() => {
          output.emit("data", Buffer.from("mp3"))
          output.emit("end")
        })
        return output
      },
    }
    return instance
  })
  ffmpeg.setFfmpegPath = vi.fn()
  return { __esModule: true, default: ffmpeg }
})

const mirrorMediaUrlMock = vi.hoisted(() => vi.fn())
const ensureFfmpegMock = vi.hoisted(() => vi.fn(async () => "/usr/bin/ffmpeg"))

vi.mock("../utils/mms.server", async () => {
  const actual = await vi.importActual<typeof import("../utils/mms.server")>("../utils/mms.server")
  // Default to the real implementation; individual tests can override.
  mirrorMediaUrlMock.mockImplementation((...args: any[]) =>
    (actual.mirrorMediaUrl as any)(...args),
  )
  return { ...actual, mirrorMediaUrl: mirrorMediaUrlMock }
})

vi.mock("../utils/ffmpeg-path", () => ({ ensureFfmpegAvailable: ensureFfmpegMock }))

const fetchMock = vi.fn()
const uploadMock = vi.fn().mockResolvedValue({ data: { path: "file.mp3" }, error: null })
const removeMock = vi.fn().mockResolvedValue({ data: null, error: null })

// @ts-ignore
global.fetch = fetchMock

vi.mock("../lib/supabase", () => ({
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

  test("falls back to the original url when conversion fails", async () => {
    mirrorMediaUrlMock.mockRejectedValueOnce(
      new Error("Converted audio exceeds the 1MB MMS limit"),
    )
    const url = "https://cdn/audio.weba"
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ url }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.converted).toBe(false)
    expect(body.url).toBe(url)
  })
})
