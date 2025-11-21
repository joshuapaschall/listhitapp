/** @jest-environment jsdom */
import { jest } from "@jest/globals"
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
    global.fetch = jest.fn(async () => ({
      blob: async () => new Blob(["audio"], { type: "audio/webm" }),
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test("saves webm recording with expected filename", async () => {
    const handleSave = jest.fn()
    render(<VoiceRecorder open onOpenChange={jest.fn()} onSave={handleSave} />)

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
