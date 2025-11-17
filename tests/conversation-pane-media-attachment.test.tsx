/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react"
import ConversationPane from "../components/inbox/conversation-pane"
import { NowProvider } from "../hooks/use-now"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Prevent network requests for mime type
// @ts-ignore
global.fetch = jest.fn(() => Promise.resolve({ headers: { get: () => null } }))

jest.mock("../services/template-service", () => ({
  TemplateService: { listTemplates: jest.fn().mockResolvedValue([]) },
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
})
