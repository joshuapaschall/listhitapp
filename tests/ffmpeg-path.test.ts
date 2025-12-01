import { jest } from "@jest/globals"

describe("ffmpeg path resolution", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  test("prefers FFMPEG_PATH environment variable when executable", async () => {
    process.env.FFMPEG_PATH = "/custom/ffmpeg"

    jest.doMock("fs", () => {
      const actual = jest.requireActual("fs")
      return { ...actual, existsSync: jest.fn(() => true) }
    })

    jest.doMock("child_process", () => {
      const actual = jest.requireActual("child_process")
      return { ...actual, spawnSync: jest.fn(() => ({ status: 0 })) }
    })

    const { getFfmpegPath } = await import("../lib/ffmpeg")
    expect(getFfmpegPath()).toBe("/custom/ffmpeg")
  })

  test("falls back to ffmpeg-static binary when env is missing", async () => {
    const ffmpegStaticPath = jest.requireActual("ffmpeg-static") as string

    jest.doMock("fs", () => {
      const actual = jest.requireActual("fs")
      return {
        ...actual,
        existsSync: jest.fn((candidate: string) => candidate === ffmpegStaticPath),
      }
    })

    jest.doMock("child_process", () => {
      const actual = jest.requireActual("child_process")
      return { ...actual, spawnSync: jest.fn(() => ({ status: 0 })) }
    })

    const { getFfmpegPath } = await import("../lib/ffmpeg")
    expect(getFfmpegPath()).toBe(ffmpegStaticPath)
  })

  test("throws in production when no FFmpeg binary can be resolved", async () => {
    process.env.NODE_ENV = "production"

    jest.doMock("ffmpeg-static", () => null)

    jest.doMock("fs", () => {
      const actual = jest.requireActual("fs")
      return { ...actual, existsSync: jest.fn(() => false) }
    })

    jest.doMock("child_process", () => {
      const actual = jest.requireActual("child_process")
      return { ...actual, spawnSync: jest.fn(() => ({ status: 1 })) }
    })

    const { ensureFfmpegAvailable } = await import("../utils/ffmpeg-path")

    await expect(ensureFfmpegAvailable()).rejects.toThrow(
      "FFmpeg binary not found in production runtime",
    )
  })
})
