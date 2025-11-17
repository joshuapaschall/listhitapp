/** @jest-environment jsdom */
import { render } from "@testing-library/react"
import ConversationRow from "../components/inbox/conversation-row"

jest.useFakeTimers().setSystemTime(new Date("2024-01-01T00:10:00Z"))

describe("ConversationRow", () => {
  test("uses now context to set dot color", () => {
    const thread = {
      id: "t1",
      updated_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      phone_number: "123",
      buyers: { id: "b1", full_name: "John Doe" },
      unread: true,
    } as any

    const { container } = render(<ConversationRow thread={thread} />)

    const dot = container.querySelector("span") as HTMLElement
    expect(dot.className.includes("bg-blue-500")).toBe(true)
  })

  test("switches to red after 5 minutes", () => {
    const thread = {
      id: "t2",
      updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      phone_number: "456",
      buyers: { id: "b2", full_name: "Jane Doe" },
      unread: true,
    } as any

    const { container } = render(<ConversationRow thread={thread} />)

    const dot = container.querySelector("span") as HTMLElement
    expect(dot.className.includes("bg-red-500")).toBe(true)
  })

  test("shows gray when read", () => {
    const thread = {
      id: "t3",
      updated_at: new Date().toISOString(),
      phone_number: "789",
      buyers: { id: "b3", full_name: "Bob" },
      unread: false,
    } as any

    const { container } = render(<ConversationRow thread={thread} />)

    const dot = container.querySelector("span") as HTMLElement
    expect(dot.className.includes("bg-gray-400")).toBe(true)
  })

  test("shows formatted timestamp", () => {
    const thread = {
      id: "t4",
      updated_at: new Date("2023-12-31T23:00:00Z").toISOString(),
      phone_number: "999",
      buyers: { id: "b4", full_name: "Tim" },
      unread: false,
    } as any

    const { getByText } = render(<ConversationRow thread={thread} />)
    expect(getByText("Yesterday")).toBeTruthy()
  })
})
