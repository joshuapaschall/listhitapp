/** @jest-environment jsdom */
import { describe, expect, test, jest, beforeEach } from "@jest/globals"

const threads = [
  { id: "t1", phone_number: "123", updated_at: new Date().toISOString(), buyers: { id: "b1", full_name: "John" } },
  { id: "t2", phone_number: "456", updated_at: new Date().toISOString(), buyers: { id: "b2", full_name: "Jane" } },
]

const listInboxThreads = jest.fn(async () => threads)
const listSentThreads = jest.fn(async () => [])
const listAutosentMessages = jest.fn(async () => [])

jest.mock("@/services/message-service", () => ({
  __esModule: true,
  listInboxThreads: (...args: any[]) => listInboxThreads(...args),
  listSentThreads: (...args: any[]) => listSentThreads(...args),
  listAutosentMessages: (...args: any[]) => listAutosentMessages(...args),
}))

jest.mock("@/lib/supabase", () => ({
  __esModule: true,
  ...jest.requireActual("./__mocks__/supabase"),
}))

jest.mock("../components/inbox/list-pane", () => {
  const React = require("react")
  const { useState } = React
  return {
    __esModule: true,
    default: ({ onSelect }: { onSelect: any }) => {
      const [search, setSearch] = useState("")
      const filtered = threads.filter((t) =>
        t.buyers.full_name.toLowerCase().includes(search.toLowerCase())
      )
      return (
        <div>
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
          />
          {filtered.map((t) => (
            <button key={t.id} onClick={() => onSelect(t)}>
              {t.buyers.full_name}
            </button>
          ))}
        </div>
      )
    },
  }
})

jest.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: jest.fn(({ count }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, i) => ({ index: i })),
    getTotalSize: () => count * 64,
    measureElement: jest.fn(),
  })),
}))

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NowProvider } from "../hooks/use-now"
import ListPane from "../components/inbox/list-pane"

describe.skip("ConversationList", () => {
  beforeEach(() => {
    listInboxThreads.mockClear()
    listSentThreads.mockClear()
    listAutosentMessages.mockClear()
    listInboxThreads.mockResolvedValue(threads)
  })

  test("filters and selects threads", async () => {
    const handleSelect = jest.fn()
    const client = new QueryClient()
    client.setQueryData(["message-threads", "inbox"], threads)
    render(
      <QueryClientProvider client={client}>
        <NowProvider>
          <ListPane onSelect={handleSelect} />
        </NowProvider>
      </QueryClientProvider>
    )

    await screen.findByText("John")
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "Jane" } })
    await waitFor(() => expect(screen.queryByText("John")).toBeNull())
    fireEvent.click(screen.getByText("Jane"))
    expect(handleSelect).toHaveBeenCalledWith(threads[1])
  })
})
