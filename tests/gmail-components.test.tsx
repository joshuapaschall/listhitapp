/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ListPane from "../components/gmail/list-pane"
import ComposeModal from "../components/gmail/compose-modal"
import ConversationPane from "../components/gmail/conversation-pane"
import { decodeMessage } from "../lib/gmail-utils"

const invalidateQueries = jest.fn()
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
  useQueryClient: () => ({ invalidateQueries }),
}))

const mockUseQuery = require("@tanstack/react-query").useQuery as jest.Mock

const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

describe("gmail components", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    mockUseQuery.mockReset()
  })

  test("ListPane renders threads and selects", () => {
    const handleSelect = jest.fn()
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
    expect(screen.getByText("(2)")).toBeTruthy()
    expect(screen.getByText("Re: S")).toBeTruthy()
  })

  test("ComposeModal sends email", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ threadId: "t1" }) })
    const onSent = jest.fn()
    const onOpenChange = jest.fn()
    render(<ComposeModal open={true} onOpenChange={onOpenChange} onSent={onSent} />)
    const fields = await screen.findAllByRole("textbox")
    fireEvent.change(fields[0], { target: { value: "to@test.com" } })
    fireEvent.change(fields[1], { target: { value: "Hi" } })
    fireEvent.change(fields[2], { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gmail/send",
      expect.objectContaining({ method: "POST" }),
    )
    expect(onSent).toHaveBeenCalledWith("t1")
    expect(onOpenChange).toHaveBeenCalledWith(false)
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
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
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
    const rows = container.querySelectorAll("div[data-testid='thread-row']")
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
    const rows = container.querySelectorAll("div[data-testid='thread-row']")
    expect(rows.length).toBe(3)
    expect(rows[0].querySelector(".bg-primary")).not.toBeNull()
    expect(rows[0].querySelector("svg")?.getAttribute("class")).toContain(
      "text-yellow-400",
    )
    expect(rows[1].querySelector(".bg-primary")).not.toBeNull()
    expect(rows[1].querySelector("svg")?.getAttribute("class")).toContain(
      "text-muted-foreground",
    )
    expect(rows[2].querySelector(".bg-primary")).toBeNull()
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

    const rows = container.querySelectorAll(
      "div[data-testid='thread-row']",
    )
    expect(rows.length).toBe(2)
    expect(rows[0].textContent).toContain("B")
    expect(rows[1].textContent).toContain("A")
  })
})
