/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react"
import ConversationPane from "../components/inbox/conversation-pane"
import { NowProvider } from "../hooks/use-now"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// jsdom doesn't implement createObjectURL
// @ts-ignore
global.URL.createObjectURL = jest.fn(() => "blob:url")

jest.mock("../components/inbox/upload-modal", () => ({
  __esModule: true,
  default: ({ open, onOpenChange, onAddFiles }: any) =>
    open ? (
      <div>
        <button onClick={() => { onAddFiles([new File(["a"], "img.jpg", { type: "image/jpeg" })]); onOpenChange(false) }}>AddFile</button>
      </div>
    ) : null,
}))

jest.mock("../services/template-service", () => ({
  TemplateService: { listTemplates: jest.fn().mockResolvedValue([]) },
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

describe("ConversationPane upload modal", () => {
  test("adds files to attachments", () => {
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222" } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )
    const btn = screen.getByRole("button", { name: /upload files/i })
    fireEvent.click(btn)
    fireEvent.click(screen.getByText("AddFile"))
    expect(document.querySelectorAll("img").length).toBe(1)
  })
})
