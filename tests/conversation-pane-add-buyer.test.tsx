/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react"
import ConversationPane from "../components/inbox/conversation-pane"
import { NowProvider } from "../hooks/use-now"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Mock AddBuyerModal to instantly create a buyer
jest.mock("../components/buyers/add-buyer-modal", () => ({
  __esModule: true,
  default: ({ open, onOpenChange, onSuccessAction }: any) =>
    open ? (
      <div>
        <button onClick={() => { onSuccessAction({ id: "b2", fname: "Jane", lname: "Doe" }); onOpenChange(false) }}>Save</button>
      </div>
    ) : null,
}))

jest.mock("../services/template-service", () => ({
  TemplateService: {
    listTemplates: jest.fn().mockResolvedValue([]),
    addTemplate: jest.fn(),
  },
}))

const updateEqMock = jest.fn().mockResolvedValue({ error: null })
const updateMock = jest.fn(() => ({ eq: updateEqMock }))

jest.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "buyers") {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: null, error: null }) })
        }
      }
      if (table === "message_threads") {
        return { update: updateMock }
      }
      return {
        select: () => ({
          eq: () => ({ is: () => ({ order: () => ({ data: [], error: null }) }), order: () => ({ data: [], error: null }) })
        })
      }
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: jest.fn(),
  }
  return { supabase: client, supabaseAdmin: client }
})

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: jest.fn(), writable: true })

describe("ConversationPane add buyer", () => {
  test("shows add buyer button", async () => {
    const thread = { id: "t1", buyer_id: null, phone_number: "+1222" } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )
    expect(await screen.findByRole("button", { name: /add buyer/i })).toBeTruthy()
  })

  test("creates buyer and links thread", async () => {
    const thread = { id: "t1", buyer_id: null, phone_number: "+1222" } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )
    const add = await screen.findByRole("button", { name: /add buyer/i })
    fireEvent.click(add)
    fireEvent.click(screen.getByText("Save"))
    expect(updateMock).toHaveBeenCalled()
    await screen.findByText("Jane Doe")
  })
})
