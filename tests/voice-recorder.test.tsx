/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import VoiceRecorder from "../components/voice/VoiceRecorder"

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
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream

  beforeEach(() => {
    ;(navigator as any).mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    }
    // @ts-ignore
    global.MediaRecorder = MockMediaRecorder
    // @ts-ignore
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url")
    // @ts-ignore
    global.fetch = vi.fn(async () => ({
      blob: async () => new Blob(["audio"], { type: "audio/webm" }),
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test("saves webm recording with expected filename", async () => {
    const handleSave = vi.fn()
    render(<VoiceRecorder open onOpenChange={vi.fn()} onSave={handleSave} />)

    fireEvent.click(screen.getByRole("button", { name: /start recording/i }))

    const stopButton = await screen.findByRole("button", { name: /stop/i })
    fireEvent.click(stopButton)

    const [useButton] = await screen.findAllByRole("button", { name: /use this recording/i })
    fireEvent.click(useButton)

    await waitFor(() => expect(handleSave).toHaveBeenCalledTimes(1))
    const file = handleSave.mock.calls[0][0] as File
    expect(file.name).toMatch(/^recording-.*\.webm$/)
    expect(file.type).toBe("audio/webm")
  })
})
