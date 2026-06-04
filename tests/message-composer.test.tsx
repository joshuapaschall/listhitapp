/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ConversationPane from "../components/inbox/conversation-pane"
import { NowProvider } from "../hooks/use-now"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const fetchMock = vi.fn()
// @ts-ignore
global.fetch = fetchMock
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), writable: true })

vi.mock("@/components/voice/CallButton", () => ({ CallButton: () => null }))
vi.mock("@/components/auth/Can", () => ({ Can: ({ children }: any) => children }))
// Radix popover doesn't open via fireEvent in jsdom — render it inline.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}))
// The quick-replies picker isn't under test here; stub it out so its (inline,
// under the popover mock) search box doesn't shadow the message textbox.
vi.mock("@/components/templates/template-picker", () => ({ default: () => null }))

vi.mock("../services/template-service", () => ({
  TemplateService: { listTemplates: vi.fn().mockResolvedValue([]), addTemplate: vi.fn() }
}))

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

describe("MessageComposer", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/messages/send") {
        return Promise.resolve({ ok: true, json: async () => ({ sid: "SM1" }) })
      }
      if (url === "/api/messages/schedule") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "db1",
            sid: "telnyx-1",
            created_at: "2024-01-01T12:30:00.000Z",
          }),
        })
      }
      if (url === "/api/agents/me") {
        return Promise.resolve({ ok: true, json: async () => ({}) })
      }
      if (url === "/api/voice-numbers") {
        return Promise.resolve({ ok: true, json: async () => ({ numbers: ["+19998887777"] }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
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

  test("schedules message when date is selected", async () => {
    const thread = {
      id: "t1",
      buyer_id: "b1",
      phone_number: "+1222",
      preferred_from_number: "+1555",
    } as any
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NowProvider>
          <ConversationPane thread={thread} />
        </NowProvider>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByTitle("Schedule message"))
    const today = new Date().getDate().toString()
    // react-day-picker day cells are buttons whose accessible name is the full
    // date; query by exact text content (the day number) instead.
    const dayButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent?.trim() === today)!
    fireEvent.click(dayButton)
    const timeInput = document.querySelector("input[type='time']") as HTMLInputElement
    fireEvent.change(timeInput, { target: { value: "12:30" } })

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hi" } })
    fireEvent.click(screen.getByText("Send"))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/schedule",
        expect.objectContaining({ method: "POST" }),
      ),
    )
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/messages/send",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
