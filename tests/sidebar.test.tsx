/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react"
import { Sidebar } from "../components/layout/sidebar"

const roleMock = jest.fn()
const invalidateQueries = jest.fn()

jest.mock("../hooks/use-user-role", () => ({
  __esModule: true,
  default: () => roleMock(),
}))

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => ({ data: 0 })),
  useQueryClient: () => ({ invalidateQueries }),
}))

jest.mock("../lib/supabase", () => {
  const channel = { on: () => channel, subscribe: () => ({}) }
  const client = { channel: () => channel, removeChannel: jest.fn() }
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
