/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react"
import ListPane from "../components/inbox/list-pane"
import { NowProvider } from "../hooks/use-now"

const invalidateQueries = jest.fn()
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
  useQueryClient: () => ({ invalidateQueries }),
}))

jest.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: jest.fn(({ count }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, i) => ({ index: i })),
    getTotalSize: () => count * 64,
    measureElement: jest.fn()
  }))
}))

jest.mock("../lib/supabase", () => {
  const client = {
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: jest.fn()
  }
  return { supabase: client, supabaseAdmin: client }
})

const mockUseQuery = require("@tanstack/react-query").useQuery as jest.Mock

describe("ConversationList", () => {
  test("filters and selects threads", () => {
    const threads = [
      { id: "t1", phone_number: "123", updated_at: new Date().toISOString(), buyers: { id: "b1", full_name: "John" } },
      { id: "t2", phone_number: "456", updated_at: new Date().toISOString(), buyers: { id: "b2", full_name: "Jane" } }
    ]
    mockUseQuery.mockReturnValue({ data: threads })
    const handleSelect = jest.fn()
    render(
      <NowProvider>
        <ListPane onSelect={handleSelect} />
      </NowProvider>
    )
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "Jane" } })
    expect(screen.queryByText("John")).toBeNull()
    fireEvent.click(screen.getByText("Jane"))
    expect(handleSelect).toHaveBeenCalledWith(threads[1])
  })
})
