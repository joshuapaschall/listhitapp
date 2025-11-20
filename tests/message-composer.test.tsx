/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ConversationPane from "../components/inbox/conversation-pane"
import { NowProvider } from "../hooks/use-now"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: jest.fn(), writable: true })

jest.mock("../services/template-service", () => ({
  TemplateService: { listTemplates: jest.fn().mockResolvedValue([]), addTemplate: jest.fn() }
}))

jest.mock("../lib/supabase", () => {
  const client = {

    from: (table: string) => {
      if (table === "buyers") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ id: "b1", fname: "John", lname: "Doe" }], error: null })
          })
        }
      }
      return {
        select: () => ({
          eq: () => ({
            is: () => ({ order: () => ({ data: [], error: null }) }),
            order: () => ({ data: [], error: null })
          })
        }),
        insert: async () => ({ data: null, error: null })
      }
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: jest.fn(),
    storage: { from: () => ({ upload: jest.fn().mockResolvedValue({ data: { path: "p" }, error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) }
  }
  return { supabase: client, supabaseAdmin: client }
})

describe("MessageComposer", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sid: "SM1" }) })
  })

  test("sends message", async () => {
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222" } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hi" } })
    fireEvent.click(screen.getByText("Send"))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        (screen.getByRole("textbox") as HTMLTextAreaElement).value,
      ).toBe("")
    )
  })
})
