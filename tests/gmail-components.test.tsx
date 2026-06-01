/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ListPane from "../components/gmail/list-pane"
import ComposeWindow from "../components/gmail/compose-window"
import ConversationPane from "../components/gmail/conversation-pane"
import { decodeMessage } from "../lib/gmail-utils"

const { mockUseQuery, invalidateQueries } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  invalidateQueries: vi.fn(),
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: mockUseQuery,
  useQueryClient: () => ({ invalidateQueries }),
}))

// TipTap doesn't run in jsdom — stub the editor with a plain textarea.
vi.mock("../components/gmail/rich-text-editor", () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea aria-label="Body" value={value || ""} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const fetchMock = vi.fn()
// @ts-ignore
global.fetch = fetchMock

const rowSelector = "div.border-b.px-4.py-2"

describe("gmail components", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    mockUseQuery.mockReset()
    invalidateQueries.mockReset()
  })

  test("ListPane renders threads and selects", () => {
    const handleSelect = vi.fn()
    render(
      <ListPane
        threads={[
          {
            id: "t1",
            snippet: "body",
            messages: [
              {
                id: "m1",
                snippet: "body",
                payload: {
                  headers: [
                    { name: "From", value: "A" },
                    { name: "Subject", value: "S" },
                  ],
                },
              },
            ],
          },
        ] as any}
        isLoading={false}
        error={undefined}
        search=""
        onSelect={handleSelect}
      />
    )
    fireEvent.click(screen.getByText("A"))
    expect(handleSelect).toHaveBeenCalledWith("t1")
  })

  test("ListPane shows latest message", () => {
    render(
      <ListPane
        threads={[
          {
            id: "t1",
            messages: [
              {
                id: "m1",
                payload: {
                  headers: [
                    { name: "From", value: "A" },
                    { name: "Subject", value: "S" },
                  ],
                },
              },
              {
                id: "m2",
                snippet: "reply",
                payload: {
                  headers: [
                    { name: "From", value: "B" },
                    { name: "Subject", value: "Re: S" },
                  ],
                },
              },
            ],
          },
        ] as any}
        isLoading={false}
        error={undefined}
        search=""
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText("B")).toBeTruthy()
    expect(screen.getByText("Re: S")).toBeTruthy()
  })

  test("ComposeWindow sends email", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ threadId: "t1" }) })
    const onSent = vi.fn()
    const onClose = vi.fn()
    render(<ComposeWindow open onClose={onClose} onSent={onSent} />)
    fireEvent.change(screen.getByPlaceholderText(/recipients/i), { target: { value: "to@test.com" } })
    fireEvent.change(screen.getByPlaceholderText(/subject/i), { target: { value: "Hi" } })
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gmail/send",
      expect.objectContaining({ method: "POST" }),
    )
    expect(onSent).toHaveBeenCalledWith("t1")
    expect(onClose).toHaveBeenCalled()
  })

  test("ConversationPane sends reply", async () => {
    mockUseQuery.mockReturnValue({
      data: {
        messages: [
          {
            id: "m1",
            payload: { headers: [{ name: "From", value: "a@test.com" }, { name: "Subject", value: "Hi" }] },
          },
        ],
      },
    })
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    render(<ConversationPane threadId="t1" />)

    // Editor is hidden until reply mode starts — click the main "Reply" button.
    const replyBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "Reply")!
    fireEvent.click(replyBtn)

    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Hello" } })

    const sendBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "Send")!
    fireEvent.click(sendBtn)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gmail/reply",
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("ConversationPane shows error message", () => {
    mockUseQuery.mockReturnValue({ data: undefined, error: new Error("oops"), isLoading: false })
    render(<ConversationPane threadId="t1" />)
    expect(screen.getByText(/failed to load thread/i)).toBeTruthy()
  })

  test("decodeMessage extracts body", () => {
    const msg = {
      id: "m1",
      payload: {
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/plain", body: { data: Buffer.from("hi").toString("base64") } },
          { mimeType: "text/html", body: { data: Buffer.from("<b>hi</b>").toString("base64") } },
        ],
      },
    }
    const out = decodeMessage(msg)
    expect(out.text).toBe("hi")
    expect(out.html).toBe("<b>hi</b>")
  })

  test("ListPane handles missing headers and snippets", () => {
    const { container } = render(
      <ListPane
        threads={[
          { id: "t1", messages: [{ id: "m1" }] },
          {
            id: "t2",
            messages: [
              { id: "m2", payload: { headers: [{ name: "From", value: "B" }] } },
            ],
          },
        ] as any}
        isLoading={false}
        error={undefined}
        search=""
        onSelect={() => {}}
      />,
    )
    const rows = container.querySelectorAll(rowSelector)
    expect(rows.length).toBe(2)
  })

  test("ListPane shows unread and starred states", () => {
    const threads = [
      {
        id: "t1",
        unread: true,
        starred: true,
        messages: [
          { id: "m1", payload: { headers: [{ name: "From", value: "A" }] } },
        ],
      },
      {
        id: "t2",
        messages: [
          {
            id: "m2",
            labelIds: ["UNREAD"],
            payload: { headers: [{ name: "From", value: "B" }] },
          },
        ],
      },
      {
        id: "t3",
        messages: [
          { id: "m3", payload: { headers: [{ name: "From", value: "C" }] } },
        ],
      },
    ] as any
    const { container } = render(
      <ListPane
        threads={threads}
        isLoading={false}
        error={undefined}
        search=""
        onSelect={() => {}}
      />,
    )
    const rows = container.querySelectorAll(rowSelector)
    expect(rows.length).toBe(3)
    // Unread is marked by font-semibold on the sender/subject text.
    expect(rows[0].querySelector(".font-semibold")).not.toBeNull()
    // Starred colors the Star svg yellow.
    expect(rows[0].querySelector("svg")?.getAttribute("class")).toContain("text-yellow-400")
    expect(rows[1].querySelector(".font-semibold")).not.toBeNull()
    expect(rows[1].querySelector("svg")?.getAttribute("class")).toContain("text-muted-foreground")
    // Read thread: no bold text.
    expect(rows[2].querySelector(".font-semibold")).toBeNull()
  })

  test("ListPane sorts threads by newest date", () => {
    const threads = [
      {
        id: "t1",
        messages: [
          {
            id: "m1",
            payload: {
              headers: [
                { name: "From", value: "A" },
                { name: "Date", value: "Mon, 01 Jan 2024 10:00:00 +0000" },
              ],
            },
          },
        ],
      },
      {
        id: "t2",
        messages: [
          {
            id: "m2",
            payload: {
              headers: [
                { name: "From", value: "B" },
                { name: "Date", value: "Tue, 02 Jan 2024 10:00:00 +0000" },
              ],
            },
          },
        ],
      },
    ] as any

    const { container } = render(
      <ListPane
        threads={threads}
        isLoading={false}
        error={undefined}
        search=""
        onSelect={() => {}}
      />,
    )

    const rows = container.querySelectorAll(rowSelector)
    expect(rows.length).toBe(2)
    expect(rows[0].textContent).toContain("B")
    expect(rows[1].textContent).toContain("A")
  })
})
