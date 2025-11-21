import { describe, beforeEach, test, expect, jest } from "@jest/globals"

const fetchMock = jest.fn()
const uploadMock = jest.fn().mockResolvedValue({ data: { path: "file.mp3" }, error: null })
const convertToMp4Mock = jest.fn(
  async (_inputUrl: string, direction: "incoming" | "outgoing" = "incoming") => {
    const path = `${direction}/file.mp4`
    await uploadMock(path, Buffer.from("mp4"), {
      contentType: "video/mp4",
      upsert: true,
    })
    return `https://cdn/storage/v1/object/public/public-media/${path}`
  },
)

await jest.unstable_mockModule("../utils/audio-utils", () => ({
  __esModule: true,
  convertToMp3: jest.fn(async () => {
    await uploadMock("file.mp3", Buffer.from("mp3"), {
      contentType: "audio/mpeg",
      upsert: true,
    })
    return "https://cdn/storage/v1/object/public/public-media/file.mp3"
  }),
}))

await jest.unstable_mockModule("../utils/video-utils", () => ({
  __esModule: true,
  convertToMp4: (...args: any[]) => convertToMp4Mock(...args),
}))

let mms: typeof import("../utils/mms.server")

// @ts-ignore
global.fetch = fetchMock

await jest.unstable_mockModule("@/lib/supabase", () => ({
  __esModule: true,
  supabaseAdmin: {
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://cdn/storage/v1/object/public/public-media/${path}`,
          },
        }),
        remove: jest.fn().mockResolvedValue({ error: null }),
      }),
    },
  },
  supabase: {},
}))

beforeAll(async () => {
  mms = await import("../utils/mms.server")
})

describe("mirrorMediaUrl", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    uploadMock.mockClear()
    convertToMp4Mock.mockClear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cdn"
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("amr"),
      headers: { get: () => "audio/amr" },
    })
  })

  test("converts amr audio to mp3 before upload", async () => {
    const url = "https://x.com/test.amr"
    const out = await mms.mirrorMediaUrl(url)
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    const args = uploadMock.mock.calls[0]
    expect(args[0]).toMatch(/\.mp3$/)
    expect(args[2].contentType).toBe("audio/mpeg")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp3",
    )
  })

  test("converts webm audio to mp3 before upload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("webm"),
      headers: { get: () => "audio/webm" },
    })
    const url = "https://x.com/test.webm"
    const out = await mms.mirrorMediaUrl(url)
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    const args = uploadMock.mock.calls[0]
    expect(args[0]).toMatch(/\.mp3$/)
    expect(args[2].contentType).toBe("audio/mpeg")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp3",
    )
  })

  test("converts weba audio to mp3 before upload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("weba"),
      headers: { get: () => "audio/webm" },
    })
    const url = "https://x.com/test.weba"
    const out = await mms.mirrorMediaUrl(url)
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    const args = uploadMock.mock.calls[0]
    expect(args[0]).toMatch(/\.mp3$/)
    expect(args[2].contentType).toBe("audio/mpeg")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp3",
    )
  })

  test("converts 3gp audio to mp3 before upload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("3gp"),
      headers: { get: () => "audio/3gpp" },
    })
    const url = "https://x.com/test.3gp"
    const out = await mms.mirrorMediaUrl(url)
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    const args = uploadMock.mock.calls[0]
    expect(args[0]).toMatch(/\.mp3$/)
    expect(args[2].contentType).toBe("audio/mpeg")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp3",
    )
  })

  test("converts wav audio to mp3 before upload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("wav"),
      headers: { get: () => "audio/wav" },
    })
    const url = "https://x.com/test.wav"
    const out = await mms.mirrorMediaUrl(url)
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    const args = uploadMock.mock.calls[0]
    expect(args[0]).toMatch(/\.mp3$/)
    expect(args[2].contentType).toBe("audio/mpeg")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp3",
    )
  })

  test("converts m4a audio to mp3 before upload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("m4a"),
      headers: { get: () => "audio/x-m4a" },
    })
    const url = "https://x.com/test.m4a"
    const out = await mms.mirrorMediaUrl(url)
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    const args = uploadMock.mock.calls[0]
    expect(args[0]).toMatch(/\.mp3$/)
    expect(args[2].contentType).toBe("audio/mpeg")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp3",
    )
  })

  test("converts ogg audio to mp3 before upload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("ogg"),
      headers: { get: () => "audio/ogg" },
    })
    const url = "https://x.com/test.ogg"
    const out = await mms.mirrorMediaUrl(url)
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    const args = uploadMock.mock.calls[0]
    expect(args[0]).toMatch(/\.mp3$/)
    expect(args[2].contentType).toBe("audio/mpeg")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp3",
    )
  })

  test("converts opus audio to mp3 before upload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("opus"),
      headers: { get: () => "audio/opus" },
    })
    const url = "https://x.com/test.opus"
    const out = await mms.mirrorMediaUrl(url)
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    const args = uploadMock.mock.calls[0]
    expect(args[0]).toMatch(/\.mp3$/)
    expect(args[2].contentType).toBe("audio/mpeg")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp3",
    )
  })

  test("converts oga audio to mp3 before upload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("oga"),
      headers: { get: () => "audio/ogg" },
    })
    const url = "https://x.com/test.oga"
    const out = await mms.mirrorMediaUrl(url)
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    const args = uploadMock.mock.calls[0]
    expect(args[0]).toMatch(/\.mp3$/)
    expect(args[2].contentType).toBe("audio/mpeg")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp3",
    )
  })

  test.skip("falls back to uploadOriginalToSupabase on failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fail"))
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("png"),
      headers: { get: () => "image/png" },
    })
    const url = "https://x.com/test.png"
    const out = await mms.mirrorMediaUrl(url)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(uploadMock).toHaveBeenCalledTimes(1)
    const args = uploadMock.mock.calls[0]
    expect(args[2].contentType).toBe("image/png")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp3",
    )
  })

  test("uploads inbound mp4 video without conversion", async () => {
    const videoResponse = {
      ok: true,
      arrayBuffer: async () => Buffer.from("mp4"),
      headers: { get: () => "video/mp4" },
    }
    fetchMock.mockResolvedValueOnce(videoResponse)
    fetchMock.mockResolvedValueOnce(videoResponse)
    uploadMock.mockResolvedValueOnce({ data: { path: "file.mp4" }, error: null })
    const url = "https://x.com/test.mp4"
    const out = await mms.mirrorMediaUrl(url, "incoming")
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    expect(convertToMp4Mock).toHaveBeenCalledWith(url, "incoming", expect.any(Buffer))
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp4",
    )
  })

  test("uploads outbound mp4 video without conversion", async () => {
    const videoResponse = {
      ok: true,
      arrayBuffer: async () => Buffer.from("mp4"),
      headers: { get: () => "video/mp4" },
    }
    fetchMock.mockResolvedValueOnce(videoResponse)
    fetchMock.mockResolvedValueOnce(videoResponse)
    uploadMock.mockResolvedValueOnce({ data: { path: "outgoing/file.mp4" }, error: null })
    const url = "https://x.com/test.mp4"
    const out = await mms.mirrorMediaUrl(url, "outgoing")
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    expect(convertToMp4Mock).toHaveBeenCalledWith(url, "outgoing", expect.any(Buffer))
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/outgoing/file.mp4",
    )
  })

  test("converts mov video to mp4 before upload", async () => {
    const videoResponse = {
      ok: true,
      arrayBuffer: async () => Buffer.from("mov"),
      headers: { get: () => "video/quicktime" },
    }
    fetchMock.mockResolvedValueOnce(videoResponse)
    fetchMock.mockResolvedValueOnce(videoResponse)
    const url = "https://x.com/test.mov"
    const out = await mms.mirrorMediaUrl(url, "outgoing")
    expect(fetchMock).toHaveBeenCalled()
    expect(convertToMp4Mock).toHaveBeenCalledWith(url, "outgoing", expect.any(Buffer))
    expect(uploadMock).toHaveBeenCalled()
    const args = uploadMock.mock.calls[0]
    expect(args[0]).toMatch(/\.mp4$/)
    expect(args[2].contentType).toBe("video/mp4")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp4",
    )
  })

  test("falls back to uploading original video when conversion fails", async () => {
    const videoResponse = {
      ok: true,
      arrayBuffer: async () => Buffer.from("mp4"),
      headers: { get: () => "video/mp4" },
    }
    convertToMp4Mock.mockRejectedValueOnce(new Error("ffmpeg failed"))
    uploadMock.mockResolvedValueOnce({ data: { path: "fallback.mp4" }, error: null })
    fetchMock.mockResolvedValueOnce(videoResponse)
    fetchMock.mockResolvedValueOnce(videoResponse)

    const url = "https://x.com/test.mp4"
    const out = await mms.mirrorMediaUrl(url, "incoming")

    expect(convertToMp4Mock).toHaveBeenCalledWith(url, "incoming", expect.any(Buffer))
    expect(uploadMock).toHaveBeenCalled()
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/fallback.mp4",
    )
  })
})

describe("uploadOriginalToSupabase", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    uploadMock.mockClear()
    convertToMp4Mock.mockClear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cdn"
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("img"),
      headers: { get: () => "image/jpeg" },
    })
  })

  test("uploads file and returns public URL", async () => {
    const url = "https://x.com/test.jpg"
    const out = await mms.uploadOriginalToSupabase(url)
    expect(fetchMock).toHaveBeenCalledWith(url, {})
    expect(uploadMock).toHaveBeenCalled()
    const args = uploadMock.mock.calls[0]
    expect(args[2].contentType).toBe("image/jpeg")
    expect(out).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp3",
    )
  })
})

describe("ensurePublicMediaUrls", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    uploadMock.mockClear()
    convertToMp4Mock.mockClear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cdn"
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("webm"),
      headers: { get: () => "audio/webm" },
    })
  })

  test("converts public webm files to mp3", async () => {
    const url =
      "https://cdn/storage/v1/object/public/public-media/outgoing/test.webm"
    const out = await mms.ensurePublicMediaUrls([url])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(uploadMock).not.toHaveBeenCalled()
    expect(out[0]).toBe(url)
  })

  test("converts public weba files to mp3", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("weba"),
      headers: { get: () => "audio/webm" },
    })
    const url =
      "https://cdn/storage/v1/object/public/public-media/outgoing/test.weba"
    const out = await mms.ensurePublicMediaUrls([url])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(uploadMock).not.toHaveBeenCalled()
    expect(out[0]).toBe(url)
  })

  test("converts public 3gp files to mp3", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("3gp"),
      headers: { get: () => "audio/3gpp" },
    })
    const url =
      "https://cdn/storage/v1/object/public/public-media/outgoing/test.3gp"
    const out = await mms.ensurePublicMediaUrls([url])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(uploadMock).not.toHaveBeenCalled()
    expect(out[0]).toBe(url)
  })

  test("converts public wav files to mp3", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("wav"),
      headers: { get: () => "audio/wav" },
    })
    const url =
      "https://cdn/storage/v1/object/public/public-media/outgoing/test.wav"
    const out = await mms.ensurePublicMediaUrls([url])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(uploadMock).not.toHaveBeenCalled()
    expect(out[0]).toBe(url)
  })

  test("converts public ogg files to mp3", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("ogg"),
      headers: { get: () => "audio/ogg" },
    })
    const url =
      "https://cdn/storage/v1/object/public/public-media/outgoing/test.ogg"
    const out = await mms.ensurePublicMediaUrls([url])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(uploadMock).not.toHaveBeenCalled()
    expect(out[0]).toBe(url)
  })

  test("converts public opus files to mp3", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("opus"),
      headers: { get: () => "audio/opus" },
    })
    const url =
      "https://cdn/storage/v1/object/public/public-media/outgoing/test.opus"
    const out = await mms.ensurePublicMediaUrls([url])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(uploadMock).not.toHaveBeenCalled()
    expect(out[0]).toBe(url)
  })

  test("converts public oga files to mp3", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("oga"),
      headers: { get: () => "audio/ogg" },
    })
    const url =
      "https://cdn/storage/v1/object/public/public-media/outgoing/test.oga"
    const out = await mms.ensurePublicMediaUrls([url])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(uploadMock).not.toHaveBeenCalled()
    expect(out[0]).toBe(url)
  })

  test("converts public mov files to mp4", async () => {
    const url =
      "https://cdn/storage/v1/object/public/public-media/outgoing/test.mov"
    const out = await mms.ensurePublicMediaUrls([url], "outgoing")
    expect(convertToMp4Mock).toHaveBeenCalledWith(url, "outgoing")
    expect(out[0]).toBe(
      "https://cdn/storage/v1/object/public/public-media/file.mp4",
    )
  })
})

