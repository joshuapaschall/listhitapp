/** @jest-environment jsdom */
import { render, fireEvent } from "@testing-library/react"
import { Header } from "../components/layout/header"

var signOutMock: vi.Mock
const pushMock = vi.fn()

vi.mock("../lib/supabase", () => {
  signOutMock = vi.fn().mockResolvedValue({ error: null })
  return { supabase: { auth: { signOut: (...args: any[]) => signOutMock(...args) } } }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock })
}))

describe("Header", () => {
  test.skip("signs out on log out click", async () => {
    const { getByTitle, findByText } = render(<Header toggleSidebar={() => {}} />)
    fireEvent.click(getByTitle("User menu"))
    const logout = await findByText(/log out/i)
    fireEvent.click(logout)
    expect(signOutMock).toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith("/login")
  })
})
