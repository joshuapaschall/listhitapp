/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react"
import ConversationPane from "../components/inbox/conversation-pane"
import { NowProvider } from "../hooks/use-now"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// jsdom doesn't implement createObjectURL
// @ts-ignore
global.URL.createObjectURL = jest.fn(() => "blob:url")

jest.mock("../components/voice/VoiceRecorder", () => ({
  __esModule: true,
  default: ({ open, onOpenChange, onSave }: any) =>
    open ? (
      <div>
        <button onClick={() => onSave(new File(["a"], "rec.webm", { type: "audio/webm" }))}>Save</button>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
}))

jest.mock("../services/template-service", () => ({
  TemplateService: { listTemplates: jest.fn().mockResolvedValue([]), addTemplate: jest.fn() },
}))

jest.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "buyers") {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [{ id: "b1", fname: "John" }], error: null }) }),
        }
      }
      return {
        select: () => ({
          eq: () => ({ is: () => ({ order: () => ({ data: [], error: null }) }), order: () => ({ data: [], error: null }) }),
        }),
        insert: async () => ({ data: null, error: null }),
      }
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: jest.fn(),
    storage: { from: () => ({ upload: jest.fn().mockResolvedValue({ data: { path: "p" }, error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  }
  return { supabase: client, supabaseAdmin: client }
})

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: jest.fn(), writable: true })

describe("ConversationPane voice recorder", () => {
  test("adds recording to attachments", () => {
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222" } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )
    const mic = screen.getByRole("button", { name: /record voice/i })
    fireEvent.click(mic)
    fireEvent.click(screen.getByText("Save"))
    expect(document.querySelectorAll("audio").length).toBe(1)
  })
})
