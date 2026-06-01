describe("ffmpeg path resolution", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  test("prefers FFMPEG_PATH environment variable when executable", async () => {
    vi.resetModules()
    process.env.FFMPEG_PATH = "/custom/ffmpeg"

    vi.doMock("fs", async () => {
      const actual = await vi.importActual<typeof import("fs")>("fs")
      const existsSync = vi.fn(() => true)
      return { ...actual, existsSync, default: { ...actual, existsSync } }
    })

    vi.doMock("child_process", async () => {
      const actual = await vi.importActual<typeof import("child_process")>("child_process")
      return { ...actual, spawnSync: vi.fn(() => ({ status: 0 })) }
    })

    const { getFfmpegPath } = await import("../lib/ffmpeg")
    expect(getFfmpegPath()).toBe("/custom/ffmpeg")
  })

  test("falls back to ffmpeg-static binary when env is missing", async () => {
    vi.resetModules()
    delete process.env.FFMPEG_PATH
    const m = await vi.importActual<any>("ffmpeg-static")
    const ffmpegStaticPath = (m?.default ?? m) as string

    vi.doMock("fs", async () => {
      const actual = await vi.importActual<typeof import("fs")>("fs")
      const existsSync = vi.fn((candidate: string) => candidate === ffmpegStaticPath)
      return { ...actual, existsSync, default: { ...actual, existsSync } }
    })

    vi.doMock("child_process", async () => {
      const actual = await vi.importActual<typeof import("child_process")>("child_process")
      return { ...actual, spawnSync: vi.fn(() => ({ status: 0 })) }
    })

    const { getFfmpegPath } = await import("../lib/ffmpeg")
    expect(getFfmpegPath()).toBe(ffmpegStaticPath)
  })

  test("throws in production when no FFmpeg binary can be resolved", async () => {
    process.env.NODE_ENV = "production"

    vi.doMock("ffmpeg-static", () => null)

    vi.doMock("fs", async () => {
      const actual = await vi.importActual<typeof import("fs")>("fs")
      return { ...actual, existsSync: vi.fn(() => false) }
    })

    vi.doMock("child_process", async () => {
      const actual = await vi.importActual<typeof import("child_process")>("child_process")
      return { ...actual, spawnSync: vi.fn(() => ({ status: 1 })) }
    })

    const { ensureFfmpegAvailable } = await import("../utils/ffmpeg-path")

    await expect(ensureFfmpegAvailable()).rejects.toThrow(
      "FFmpeg binary not found in production runtime",
    )
  })
})
