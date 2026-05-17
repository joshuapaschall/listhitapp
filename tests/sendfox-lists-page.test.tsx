/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react"
import SendFoxListsPage from "../app/admin/sendfox-lists/page"
import { resyncListAction } from "../app/admin/sendfox-lists/actions"

const mockFetchLists = vi.fn()
const mockReconcile = vi.fn()

vi.mock("../services/sendfox-service", () => ({
  fetchLists: (...args: any[]) => mockFetchLists(...args),
  reconcileSendfoxList: (...args: any[]) => mockReconcile(...args),
}))

vi.mock("../lib/get-user-role", () => ({
  getUserRole: vi.fn().mockResolvedValue("admin"),
}))

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createServerComponentClient: () => ({}),
}))

vi.mock("next/headers", () => ({
  cookies: () => ({}),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

describe("SendFoxListsPage", () => {
  test("renders lists", async () => {
    mockFetchLists.mockResolvedValue([
      {
        id: 1,
        name: "List A",
        contact_count: 3,
        created_at: "2024-01-01T00:00:00Z",
        group: { id: "g1", name: "Group1" },
        last_sync_status: "dry_run",
        last_sync_at: "2024-01-02T00:00:00Z",
        pending_mismatches: 2,
      },
    ])
    render(await SendFoxListsPage())
    expect(await screen.findByText("List A")).toBeTruthy()
    expect(screen.getByText("3")).toBeTruthy()
    expect(screen.getByText("Group1")).toBeTruthy()
    expect(screen.getByText(/dry run/i)).toBeTruthy()
    expect(screen.getByText(/pending/i)).toBeTruthy()
    expect(screen.getByText(/Preview Diff/)).toBeTruthy()
  })

  test("resync action calls service", async () => {
    const fd = new FormData()
    fd.set("id", "5")
    await resyncListAction(fd)
    expect(mockReconcile).toHaveBeenCalledWith(5, { dryRun: true })
  })
})
