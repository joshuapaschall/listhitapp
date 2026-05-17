/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react"
import { Sidebar } from "../components/layout/sidebar"

const roleMock = vi.fn()
const invalidateQueries = vi.fn()

vi.mock("../hooks/use-user-role", () => ({
  __esModule: true,
  default: () => roleMock(),
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: 0 })),
  useQueryClient: () => ({ invalidateQueries }),
}))

vi.mock("../lib/supabase", () => {
  const channel = { on: () => channel, subscribe: () => ({}) }
  const client = { channel: () => channel, removeChannel: vi.fn() }
  return { supabase: client, supabaseAdmin: client }
})

describe("Sidebar admin links", () => {
  test("shows admin navigation when role is admin", () => {
    roleMock.mockReturnValue("admin")
    render(<Sidebar />)
    fireEvent.click(screen.getByText("Admin"))
    expect(screen.getByText("Users")).toBeTruthy()
    expect(screen.getByText("Permissions")).toBeTruthy()
  })

  test("hides admin navigation for users", () => {
    roleMock.mockReturnValue("user")
    render(<Sidebar />)
    expect(screen.queryByText("Admin")).toBeNull()
  })
})
