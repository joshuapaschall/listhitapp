/** @jest-environment jsdom */
import { jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import VoiceRecorder from "../components/voice/VoiceRecorder"

jest.mock("../utils/uploadMedia", () => ({
  uploadMediaFileWithMeta: jest.fn(async () => ({
    url: "https://example.com/source.webm",
    storagePath: "outgoing/source.webm",
    contentType: "audio/webm",
  })),
}))

class MockMediaRecorder {
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  stream: MediaStream
  state: "inactive" | "recording" = "inactive"

  constructor(stream: MediaStream) {
    this.stream = stream
  }

  start() {
    this.state = "recording"
  }

  stop() {
    this.state = "inactive"
    const blob = new Blob(["audio"], { type: "audio/webm" })
    this.ondataavailable?.({ data: blob })
    this.onstop?.()
    this.stream.getTracks().forEach((track) => track.stop())
  }
}

describe("VoiceRecorder", () => {
  const mockStream = {
    getTracks: () => [{ stop: jest.fn() }],
  } as unknown as MediaStream

  beforeEach(() => {
    ;(navigator as any).mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(mockStream),
    }
    // @ts-ignore
    global.MediaRecorder = MockMediaRecorder
    // @ts-ignore
    global.URL.createObjectURL = jest.fn(() => "blob:mock-url")
    // @ts-ignore
    const fetchMock = jest.fn(async (input: RequestInfo) => {
      const inputStr = typeof input === "string" ? input : ""
      if (inputStr.includes("/api/media/convert")) {
        return {
          ok: true,
          json: async () => ({ url: "https://example.com/converted.mp3" }),
        } as any
      }
      if (inputStr.endsWith(".mp3")) {
        return {
          ok: true,
          blob: async () => new Blob(["mp3"], { type: "audio/mpeg" }),
        } as any
      }
      return {
        ok: true,
        blob: async () => new Blob(["audio"], { type: "audio/webm" }),
        json: async () => ({}),
      } as any
    })
    // @ts-ignore
    global.fetch = fetchMock
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test("converts recording to mp3 before saving", async () => {
    const handleSave = jest.fn()
    render(<VoiceRecorder open onOpenChange={jest.fn()} onSave={handleSave} />)

    fireEvent.click(screen.getByRole("button", { name: /start recording/i }))

    const stopButton = await screen.findByRole("button", { name: /stop/i })
    fireEvent.click(stopButton)

    const [useButton] = await screen.findAllByRole("button", { name: /use this recording/i })
    fireEvent.click(useButton)

    await waitFor(() => expect(handleSave).toHaveBeenCalledTimes(1))
    const file = handleSave.mock.calls[0][0] as File
    expect(file.name).toMatch(/^recording-.*\.mp3$/)
    expect(file.type).toBe("audio/mpeg")
  })
})
