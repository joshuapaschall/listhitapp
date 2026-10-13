/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Buyer } from "@/lib/supabase"

const h = vi.hoisted(() => ({
  // The toolbar test renders the real TipTap editor; the send tests swap in a
  // textarea so the body can be typed into.
  useRealEditor: false,
  consent: null as Record<string, any> | null,
}))

vi.mock("@/components/gmail/rich-text-editor", async () => {
  const actual = await vi.importActual<any>("@/components/gmail/rich-text-editor")
  const Real = actual.default
  return {
    __esModule: true,
    default: (props: any) =>
      h.useRealEditor ? (
        <Real {...props} />
      ) : (
        <textarea aria-label="Body" value={props.value || ""} onChange={(e) => props.onChange(e.target.value)} />
      ),
  }
})

vi.mock("@/components/messaging/recipient-picker", () => ({
  __esModule: true,
  default: ({ value, placeholder }: any) => <span data-testid={`picker-${placeholder || "to"}`}>{value?.value || ""}</span>,
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: h.consent, error: null }),
      }
      return q
    },
  },
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import SendEmailModal from "../components/buyers/send-email-modal"

const fetchMock = vi.fn()
// @ts-ignore
global.fetch = fetchMock

const SENDERS = [
  { id: "s-1", fromEmail: "josh@acme.test", fromName: "Josh", replyTo: null, isDefault: true },
  { id: "s-2", fromEmail: "deals@acme.test", fromName: "Deals", replyTo: null, isDefault: false },
]

const buyer = (over: Partial<Buyer> = {}) =>
  ({ id: "b-1", full_name: "Jane Doe", email: "jane@buyer.test", can_receive_email: true, ...over }) as Buyer

function mockApi(senders: any[]) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/email/sender-options") return { ok: true, json: async () => ({ senders }) }
    if (url === "/api/email/send-direct") return { ok: true, json: async () => ({ ok: true, messageId: "m-1" }) }
    throw new Error(`unexpected fetch ${url}`)
  })
}

function renderModal(b: Buyer | null = buyer()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SendEmailModal open onOpenChange={() => {}} buyer={b} />
    </QueryClientProvider>,
  )
}

function fillAndSend() {
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Hi" } })
  fireEvent.change(screen.getByLabelText("Body"), { target: { value: "<p>Hello</p>" } })
}

describe("SendEmailModal", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    h.useRealEditor = false
    h.consent = null
    try {
      window.localStorage.clear()
    } catch {}
  })

  test("titles the dialog New email and shows the helper line", async () => {
    mockApi(SENDERS)
    renderModal()
    expect(screen.getByText("New email")).toBeInTheDocument()
    expect(screen.getByText("Your business address and an unsubscribe link are added automatically.")).toBeInTheDocument()
  })

  test("renders a dropdown when there are 2+ senders", async () => {
    mockApi(SENDERS)
    renderModal()
    const trigger = await screen.findByRole("combobox", { name: "From" })
    expect(trigger).toHaveTextContent("Josh <josh@acme.test>")
  })

  test("renders static text when there is 1 sender", async () => {
    mockApi([SENDERS[0]])
    renderModal()
    expect(await screen.findByText("Josh <josh@acme.test>")).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "From" })).toBeNull()
    expect(screen.getByText("Default")).toBeInTheDocument()
  })

  test("no-sender state disables Send and links to email domains", async () => {
    mockApi([])
    renderModal()
    expect(await screen.findByText(/No verified sender yet/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Add and verify a sending domain" })).toHaveAttribute("href", "/settings/email-domains")
    fillAndSend()
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
  })

  test("an opted-out buyer shows the notice and disables Send", async () => {
    mockApi(SENDERS)
    renderModal(buyer({ can_receive_email: false, unsubscribed_at: "2026-09-01T12:00:00Z" }))
    await screen.findByRole("combobox", { name: "From" })
    expect(screen.getByRole("alert")).toHaveTextContent(/This buyer unsubscribed from email on .*2026.*You can't email them\./)
    fillAndSend()
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
  })

  test("an opted-out buyer without a date gets the generic notice", async () => {
    mockApi(SENDERS)
    renderModal(buyer({ email_suppressed: true }))
    await screen.findByRole("combobox", { name: "From" })
    expect(screen.getByRole("alert")).toHaveTextContent("This buyer has opted out of email. You can't email them.")
  })

  test("submit posts to send-direct with the selected sender — never Gmail", async () => {
    window.localStorage.setItem("listhit:lastSenderId", "s-2")
    mockApi(SENDERS)
    renderModal()
    const trigger = await screen.findByRole("combobox", { name: "From" })
    await waitFor(() => expect(trigger).toHaveTextContent("Deals <deals@acme.test>"))
    fillAndSend()
    const send = screen.getByRole("button", { name: /send/i })
    await waitFor(() => expect(send).not.toBeDisabled())
    fireEvent.click(send)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/email/send-direct", expect.anything()))
    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/email/send-direct")!
    expect(JSON.parse(init.body)).toEqual({
      senderId: "s-2",
      to: "jane@buyer.test",
      cc: [],
      bcc: [],
      subject: "Hi",
      html: "<p>Hello</p>",
      buyerId: "b-1",
    })
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/gmail"))).toBe(false)
    await waitFor(() => expect(window.localStorage.getItem("listhit:lastSenderId")).toBe("s-2"))
  })

  test("the default sender is preselected when there is no last-used sender", async () => {
    mockApi([SENDERS[1], SENDERS[0]])
    renderModal()
    const trigger = await screen.findByRole("combobox", { name: "From" })
    await waitFor(() => expect(trigger).toHaveTextContent("Josh <josh@acme.test>"))
  })

  test("the editor toolbar renders all 12 controls", async () => {
    h.useRealEditor = true
    mockApi(SENDERS)
    renderModal()
    await screen.findByRole("combobox", { name: "From" })
    const titles = [
      "Undo", "Redo", "Bold", "Italic", "Underline", "Strikethrough", "Link",
      "Bullet list", "Numbered list", "Quote", "Inline code", "Clear formatting",
    ]
    await waitFor(() => {
      for (const title of titles) expect(screen.getByTitle(title)).toBeInTheDocument()
    })
  })
})
