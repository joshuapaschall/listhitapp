/** @jest-environment jsdom */
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react"
import { jest } from "@jest/globals"
import ConversationPane from "../components/inbox/conversation-pane"
import { NowProvider } from "../hooks/use-now"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { uploadMediaFile } from "../utils/uploadMedia"
import { TextEncoder, TextDecoder } from "util"

// Polyfill encoders for libraries that expect them in the test environment
// @ts-ignore
global.TextEncoder = TextEncoder
// @ts-ignore
global.TextDecoder = TextDecoder

// Prevent network requests for mime type
// @ts-ignore
global.fetch = jest.fn(() => Promise.resolve({ headers: { get: () => null }, ok: true, json: async () => ({}) }))
const fetchMock = global.fetch as jest.Mock
const uploadMock = jest.fn()

const mockUploads: File[][] = []

jest.mock("../components/inbox/upload-modal", () => ({
  __esModule: true,
  default: ({ open, onAddFiles, onOpenChange }: any) =>
    open ? (
      <button
        onClick={() => {
          const next = mockUploads.shift() || []
          onAddFiles(next)
          onOpenChange?.(false)
        }}
      >
        Add Mock File
      </button>
    ) : null,
}))

jest.mock("../components/voice/VoiceRecorder", () => ({
  __esModule: true,
  default: ({ open, onOpenChange, onSave }: any) =>
    open ? (
      <div>
        <button
          onClick={() =>
            onSave(new File(["voice"], "recording-123.webm", { type: "audio/webm" }))
          }
        >
          Save Recording
        </button>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
}))

jest.mock("../utils/uploadMedia", () => {
  const actual = jest.requireActual("../utils/uploadMedia")
  return {
    ...actual,
    uploadMediaFile: uploadMock,
    MAX_MMS_SIZE: 1 * 1024 * 1024,
  }
})

jest.mock("../services/template-service", () => ({
  TemplateService: { listTemplates: jest.fn().mockResolvedValue([]), addTemplate: jest.fn() },
}))

const message: any = {
  id: "m1",
  thread_id: "t1",
  buyer_id: "b1",
  direction: "inbound",
  from_number: "+1222",
  to_number: null,
  body: null,
  provider_id: null,
  is_bulk: false,
  filtered: false,
  media_urls: ["http://x.com/test.mp4"],
  created_at: new Date().toISOString(),
  deleted_at: null,
}

jest.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "buyers") {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [{ id: "b1", fname: "John" }], error: null }) }),
        }
      }
      if (table === "messages") {
        return {
          select: () => ({
            eq: () => ({ is: () => ({ order: () => ({ data: [message], error: null }) }) }),
          }),
        }
      }
      if (table === "email_messages") {
        return {
          select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }),
        }
      }
      return { select: () => ({}) }
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: jest.fn(),
  }
  return { supabase: client, supabaseAdmin: client }
})

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: jest.fn(), writable: true })

describe("ConversationPane media attachments", () => {
  beforeEach(() => {
    message.media_urls = ["http://x.com/test.mp4"]
    fetchMock.mockReset()
    fetchMock.mockImplementation(() =>
      Promise.resolve({ headers: { get: () => null }, ok: true, json: async () => ({}) }),
    )
    mockUploads.length = 0
    uploadMock.mockReset()
    uploadMock.mockImplementation(async (file: File) => `https://cdn/${file.name}`)
  })
  test("renders mp4 attachments as playable video", async () => {
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )
    await waitFor(() => expect(document.querySelectorAll("video").length).toBe(1))
  })

  test("renders mp3 attachments with query as audio", async () => {
    message.media_urls = ["http://x.com/test.mp3?t=123"]
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )
    await waitFor(() => expect(document.querySelectorAll("audio").length).toBe(1))
  })

  test("renders mp3 attachments as audio", async () => {
    message.media_urls = ["http://x.com/test.mp3"]
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )
    await waitFor(() => expect(document.querySelectorAll("audio").length).toBe(1))
  })

  test("renders weba attachments as audio", async () => {
    message.media_urls = ["http://x.com/test.weba"]
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "http://x.com/test.mp3" }),
      headers: { get: () => null },
    })
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )
    await waitFor(() => expect(document.querySelectorAll("audio").length).toBe(1))
  })

  test("shows error indicator when convert fails", async () => {
    message.media_urls = ["http://x.com/test.weba"]
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "convert failed" }),
      headers: { get: () => null },
    })
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )
    await waitFor(() =>
      expect(document.querySelectorAll("[data-testid='convert-error']").length).toBe(1)
    )
  })

  test("renders wav attachments as audio", async () => {
    message.media_urls = ["http://x.com/test.wav"]
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )
    await waitFor(() => expect(document.querySelectorAll("audio").length).toBe(0))
  })

  test("sends recorder webm as converted mp3 in media_urls", async () => {
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    fetchMock.mockImplementation((url: RequestInfo | URL, options?: any) => {
      if (typeof url === "string" && url.includes("/api/media/convert")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ url: "https://cdn/recording-123.mp3" }),
          headers: { get: () => null },
        })
      }
      if (typeof url === "string" && url.includes("/api/messages/send")) {
        const body = JSON.parse(options?.body || "{}")
        expect(body.mediaUrls).toEqual(["https://cdn/recording-123.mp3"])
        return Promise.resolve({ ok: true, json: async () => ({ sid: "sid-123" }) })
      }
      return Promise.resolve({ headers: { get: () => null }, ok: true, json: async () => ({}) })
    })

    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: /record voice/i }))
    fireEvent.click(screen.getByText("Save Recording"))
    await act(async () => {
      fireEvent.click(screen.getByText("Send"))
    })

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages/send"),
        expect.anything(),
      ),
    )
    expect(uploadMock).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/media/convert"),
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("sends small mp4 video as MMS media", async () => {
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    mockUploads.push([new File(["video"], "clip.mp4", { type: "video/mp4" })])

    fetchMock.mockImplementation((url: RequestInfo | URL, options?: any) => {
      if (typeof url === "string" && url.includes("/api/messages/send")) {
        const body = JSON.parse(options?.body || "{}")
        expect(body.mediaUrls).toEqual(["https://cdn/clip.mp4"])
        return Promise.resolve({ ok: true, json: async () => ({ sid: "sid-456" }) })
      }
      return Promise.resolve({ headers: { get: () => null }, ok: true, json: async () => ({}) })
    })

    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByLabelText("Add media"))
    fireEvent.click(screen.getByText("Video"))
    fireEvent.click(screen.getByText("Add Mock File"))

    await act(async () => {
      fireEvent.click(screen.getByText("Send"))
    })

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages/send"),
        expect.anything(),
      ),
    )
    expect(uploadMock).toHaveBeenCalled()
  })

  test("sends >1MB mp4 as download link instead of MMS", async () => {
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    const bigBuffer = new Uint8Array(Math.ceil(1.2 * 1024 * 1024))
    mockUploads.push([new File([bigBuffer], "big.mp4", { type: "video/mp4" })])

    fetchMock.mockImplementation((url: RequestInfo | URL, options?: any) => {
      if (typeof url === "string" && url.includes("/api/messages/send")) {
        const body = JSON.parse(options?.body || "{}")
        expect(body.mediaUrls).toEqual([])
        expect(body.body).toContain("Download link (over 1MB):")
        expect(body.body).toContain("big.mp4")
        expect(body.body).toContain("https://cdn/big.mp4")
        return Promise.resolve({ ok: true, json: async () => ({ sid: "sid-789" }) })
      }
      return Promise.resolve({ headers: { get: () => null }, ok: true, json: async () => ({}) })
    })

    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByLabelText("Add media"))
    fireEvent.click(screen.getByText("Video"))
    fireEvent.click(screen.getByText("Add Mock File"))

    await act(async () => {
      fireEvent.click(screen.getByText("Send"))
    })

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages/send"),
        expect.anything(),
      ),
    )
    expect(uploadMock).toHaveBeenCalled()
  })
})
