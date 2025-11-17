/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react"
import SendFoxListsPage, { resyncListAction } from "../app/admin/sendfox-lists/page"

const mockFetchLists = jest.fn()
const mockResync = jest.fn()

jest.mock("../services/sendfox-service", () => ({
  fetchLists: (...args: any[]) => mockFetchLists(...args),
  resyncList: (...args: any[]) => mockResync(...args),
}))

jest.mock("../lib/get-user-role", () => ({
  getUserRole: jest.fn().mockResolvedValue("admin"),
}))

jest.mock("@supabase/auth-helpers-nextjs", () => ({
  createServerComponentClient: () => ({}),
}))

jest.mock("next/headers", () => ({
  cookies: () => ({}),
}))

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

describe("SendFoxListsPage", () => {
  test("renders lists", async () => {
    mockFetchLists.mockResolvedValue([
      {
        id: 1,
        name: "List A",
        contact_count: 3,
        created_at: "2024-01-01T00:00:00Z",
        group: { id: "g1", name: "Group1" },
      },
    ])
    render(await SendFoxListsPage())
    expect(await screen.findByText("List A")).toBeTruthy()
    expect(screen.getByText("3")).toBeTruthy()
    expect(screen.getByText("Group1")).toBeTruthy()
  })

  test("resync action calls service", async () => {
    const fd = new FormData()
    fd.set("id", "5")
    await resyncListAction(fd)
    expect(mockResync).toHaveBeenCalledWith(5)
  })
})
