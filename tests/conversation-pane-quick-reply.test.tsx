/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ConversationPane from "../components/inbox/conversation-pane"
import { NowProvider } from "../hooks/use-now"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const fetchMock = vi.fn()
// @ts-ignore
global.fetch = fetchMock
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), writable: true })

const { listTemplatesMock } = vi.hoisted(() => ({
  listTemplatesMock: vi.fn().mockResolvedValue([{ id: "qr1", name: "Quick 1", message: "Quick message" }]),
}))

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
// Radix popover doesn't open via fireEvent in jsdom — render it inline so the
// quick-replies picker content mounts (and fetches templates) immediately.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}))

vi.mock("../services/template-service", () => {
  return { TemplateService: { listTemplates: listTemplatesMock, addTemplate: vi.fn() } }
})

vi.mock("../lib/supabase", () => {
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
    removeChannel: vi.fn(),
    storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ data: { path: "p" }, error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) }
  }
  return { supabase: client, supabaseAdmin: client }
})

describe("ConversationPane quick replies", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sid: "SM1" }) })
    listTemplatesMock.mockResolvedValue([{ id: "qr1", name: "Quick 1", message: "Quick message" }] as any)
  })

  test("loads quick reply templates and inserts message", async () => {
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222" } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )

    await waitFor(() => expect(listTemplatesMock).toHaveBeenCalledWith("quick_reply"))

    fireEvent.click(await screen.findByText("Quick 1"))

    const textarea = screen.getAllByRole("textbox")[0] as HTMLTextAreaElement
    expect(textarea.value).toBe("Quick message")
  })

  test("manage templates link points to quick replies", async () => {
    const thread = { id: "t1", buyer_id: "b1", phone_number: "+1222" } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>
    )

    await waitFor(() => expect(listTemplatesMock).toHaveBeenCalled())

    const manageLink = (await screen.findByText("Manage")).closest("a")
    expect(manageLink).toHaveAttribute("href", "/settings/templates/quick-reply")
  })
})
