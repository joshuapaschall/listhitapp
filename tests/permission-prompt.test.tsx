/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react"
import PermissionPrompt from "../components/PermissionPrompt"

vi.mock("@/utils/unlock-audio", () => ({
  __esModule: true,
  default: vi.fn(() => vi.fn()),
}))

describe("PermissionPrompt", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test("shows dialog when permissions missing", async () => {
    Object.defineProperty(global, "Notification", {
      writable: true,
      value: { permission: "default", requestPermission: vi.fn() },
    })
    ;(navigator as any).permissions = {
      query: vi.fn().mockResolvedValue({ state: "prompt" }),
    }
    render(<PermissionPrompt />)
    expect(await screen.findByText("Permissions Required")).not.toBeNull()
  })

  test("does not render when permissions granted", async () => {
    Object.defineProperty(global, "Notification", {
      writable: true,
      value: { permission: "granted", requestPermission: vi.fn() },
    })
    ;(navigator as any).permissions = {
      query: vi.fn().mockResolvedValue({ state: "granted" }),
    }
    localStorage.setItem("audioUnlocked", "true")
    render(<PermissionPrompt />)
    await waitFor(() => {
      expect(screen.queryByText("Permissions Required")).toBeNull()
    })
  })

  test("requests all permissions on enable", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted")
    Object.defineProperty(global, "Notification", {
      writable: true,
      value: { permission: "default", requestPermission },
    })
    const permissionsQuery = vi.fn().mockResolvedValue({ state: "prompt" })
    ;(navigator as any).permissions = { query: permissionsQuery }
    const getUserMedia = vi.fn().mockResolvedValue({})
    ;(navigator.mediaDevices as any) = { getUserMedia }
    const play = vi.fn().mockResolvedValue(undefined)
    const pause = vi.fn()
    ;(global as any).Audio = vi.fn(() => ({ play, pause, currentTime: 0 }))
    render(<PermissionPrompt />)
    const btn = await screen.findByText("Enable Permissions")
    btn.click()
    await waitFor(() => {
      expect(requestPermission).toHaveBeenCalled()
      expect(getUserMedia).toHaveBeenCalled()
      expect(play).toHaveBeenCalled()
    })
  })
})
