/** @jest-environment jsdom */
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import ConversationPane from "../components/inbox/conversation-pane"
import { NowProvider } from "../hooks/use-now"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MAX_MMS_SIZE } from "../utils/uploadMedia"

const fetchMock = vi.fn()
// @ts-ignore
global.fetch = fetchMock

const uploadMock = vi.fn()

vi.mock("@/components/voice/CallButton", () => ({ CallButton: () => null }))
vi.mock("@/components/auth/Can", () => ({ Can: ({ children }: any) => children }))
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: any) => (
    <div role="menuitem" onClick={() => onSelect?.({})}>{children}</div>
  ),
  DropdownMenuSeparator: () => null,
}))

vi.mock("../utils/uploadMedia", async () => {
  const actual = await vi.importActual<typeof import("../utils/uploadMedia")>("../utils/uploadMedia")
  return { ...actual, uploadMediaFileWithMeta: (...args: any[]) => uploadMock(...args) }
})

let mockRecorderFile: File | null = null
let mockUploadFiles: File[] = []

vi.mock("../components/voice/VoiceRecorder", () => ({
  __esModule: true,
  default: ({ open, onOpenChange, onSave }: any) =>
    open && mockRecorderFile ? (
      <button
        onClick={() => {
          onSave(mockRecorderFile)
          onOpenChange(false)
        }}
      >
        SaveRecording
      </button>
    ) : null,
}))

vi.mock("../components/inbox/upload-modal", () => ({
  __esModule: true,
  default: ({ open, onOpenChange, onAddFiles }: any) =>
    open ? (
      <div>
        <button
          onClick={() => {
            onAddFiles(mockUploadFiles)
            onOpenChange(false)
          }}
        >
          AddFiles
        </button>
      </div>
    ) : null,
}))

vi.mock("../services/template-service", () => ({
  TemplateService: { listTemplates: vi.fn().mockResolvedValue([]), addTemplate: vi.fn() },
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

vi.mock("../lib/supabase", () => {
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
    removeChannel: vi.fn(),
  }
  return { supabase: client, supabaseAdmin: client }
})

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), writable: true })
// jsdom doesn't implement createObjectURL
// @ts-ignore
global.URL.createObjectURL = vi.fn(() => "blob:url")

describe("ConversationPane media attachments", () => {
  beforeEach(() => {
    message.media_urls = ["http://x.com/test.mp4"]
    fetchMock.mockReset()
    uploadMock.mockReset()
    mockRecorderFile = null
    mockUploadFiles = []
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ numbers: ["+19998887777"] }),
        headers: { get: () => null },
      }),
    )
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
    ;(global.fetch as vi.Mock).mockResolvedValueOnce({
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
    fetchMock.mockImplementation((url: string) =>
      url === "/api/media/convert"
        ? Promise.resolve({
            ok: false,
            json: async () => ({ error: "convert failed" }),
            headers: { get: () => null },
          })
        : Promise.resolve({
            ok: true,
            json: async () => ({ numbers: ["+19998887777"] }),
            headers: { get: () => null },
          }),
    )
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

  test("sends webm recording as the uploaded url (server converts)", async () => {
    mockRecorderFile = new File(["audio"], "recording-123.webm", {
      type: "audio/webm",
    })
    uploadMock.mockResolvedValueOnce({
      url: "https://cdn/outgoing/recording-123.webm",
      storagePath: "outgoing/recording-123.webm",
      contentType: "audio/webm",
    })
    const sentBodies: any[] = []
    fetchMock.mockImplementation((url: string, options?: any) => {
      if (url === "/api/messages/send") {
        sentBodies.push(JSON.parse(options?.body || "{}"))
        return Promise.resolve({ ok: true, json: async () => ({ sid: "msg_1" }) })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ numbers: ["+19998887777"] }),
        headers: { get: () => null },
      })
    })

    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: /record voice/i }))
    fireEvent.click(screen.getByText("SaveRecording"))
    fireEvent.click(screen.getByRole("button", { name: /send/i }))

    await waitFor(() => expect(sentBodies.length).toBe(1))
    // The client no longer pre-converts to mp3 — it sends the uploaded webm URL
    // and the server handles conversion. (Display-side MediaAttachment may still
    // request conversion to render the sent bubble; that's not the send path.)
    expect(sentBodies[0].mediaUrls).toEqual([
      "https://cdn/outgoing/recording-123.webm",
    ])
  })

  test("sends small mp4 as MMS media", async () => {
    mockUploadFiles = [new File(["video"], "clip.mp4", { type: "video/mp4" })]
    uploadMock.mockResolvedValueOnce({
      url: "https://cdn/outgoing/clip.mp4",
      storagePath: "outgoing/clip.mp4",
      contentType: "video/mp4",
    })
    const sentBodies: any[] = []
    fetchMock.mockImplementation((url: string, options?: any) => {
      if (url === "/api/messages/send") {
        sentBodies.push(JSON.parse(options?.body || "{}"))
        return Promise.resolve({ ok: true, json: async () => ({ sid: "msg_2" }) })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ numbers: ["+19998887777"] }),
        headers: { get: () => null },
      })
    })

    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByText("Video"))
    fireEvent.click(screen.getByText("AddFiles"))
    fireEvent.click(screen.getByRole("button", { name: /send/i }))

    await waitFor(() => expect(sentBodies.length).toBe(1))
    expect(sentBodies[0].mediaUrls).toEqual(["https://cdn/outgoing/clip.mp4"])
  })

  test("large mp4 is converted to download link", async () => {
    mockUploadFiles = [
      new File([new Uint8Array(MAX_MMS_SIZE + 10)], "big.mp4", { type: "video/mp4" }),
    ]
    uploadMock.mockResolvedValueOnce({
      url: "https://cdn/outgoing/big.mp4",
      storagePath: "outgoing/big.mp4",
      contentType: "video/mp4",
    })
    const sentBodies: any[] = []
    fetchMock.mockImplementation((url: string, options?: any) => {
      if (url === "/api/messages/send") {
        sentBodies.push(JSON.parse(options?.body || "{}"))
        return Promise.resolve({ ok: true, json: async () => ({ sid: "msg_3" }) })
      }
      if (url === "/api/media-links") {
        return Promise.resolve({ ok: true, json: async () => ({ shortUrl: "https://s.io/big" }) })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ numbers: ["+19998887777"] }),
        headers: { get: () => null },
      })
    })

    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222", campaign_id: null } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByText("Video"))
    fireEvent.click(screen.getByText("AddFiles"))
    fireEvent.click(screen.getByRole("button", { name: /send/i }))

    await waitFor(() => expect(sentBodies.length).toBe(1))
    expect(sentBodies[0].mediaUrls).toEqual([])
    expect(sentBodies[0].body).toContain("Attached file:")
    expect(sentBodies[0].body).toContain("big.mp4")
    expect(sentBodies[0].body).toContain("https://s.io/big")
  })
})
