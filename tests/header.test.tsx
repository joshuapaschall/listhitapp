/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { Header } from "../components/layout/header"

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn().mockResolvedValue({ error: null }),
}))

// LogoutButton now signs out via supabaseBrowser() and navigates with
// window.location.href (no router, no inline supabase.auth).
vi.mock("@/lib/supabase-browser", () => ({
  supabaseBrowser: () => ({ auth: { signOut: signOutMock } }),
}))

// Header consumes useCall(); return a no-op proxy.
vi.mock("@/components/voice/CallProvider", () => ({
  CallProvider: ({ children }: any) => children,
  useCall: () => new Proxy({}, { get: () => () => {} }),
}))

// Header consumes useNotifications() (react-query + supabase realtime) — stub it.
vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: () => ({ notifications: [], unreadCount: 0, markAsRead: vi.fn() }),
}))

describe("Header", () => {
  test("signs out on log out click", async () => {
    render(<Header toggleSidebar={() => {}} />)
    fireEvent.click(screen.getAllByText(/log out/i)[0])
    await waitFor(() => expect(signOutMock).toHaveBeenCalled())
  })
})
