/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react"
import PermissionPrompt from "../components/PermissionPrompt"

jest.mock("@/utils/unlock-audio", () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
}))

describe("PermissionPrompt", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test("shows dialog when permissions missing", async () => {
    Object.defineProperty(global, "Notification", {
      writable: true,
      value: { permission: "default", requestPermission: jest.fn() },
    })
    ;(navigator as any).permissions = {
      query: jest.fn().mockResolvedValue({ state: "prompt" }),
    }
    render(<PermissionPrompt />)
    expect(await screen.findByText("Permissions Required")).not.toBeNull()
  })

  test("does not render when permissions granted", async () => {
    Object.defineProperty(global, "Notification", {
      writable: true,
      value: { permission: "granted", requestPermission: jest.fn() },
    })
    ;(navigator as any).permissions = {
      query: jest.fn().mockResolvedValue({ state: "granted" }),
    }
    localStorage.setItem("audioUnlocked", "true")
    render(<PermissionPrompt />)
    await waitFor(() => {
      expect(screen.queryByText("Permissions Required")).toBeNull()
    })
  })

  test("requests all permissions on enable", async () => {
    const requestPermission = jest.fn().mockResolvedValue("granted")
    Object.defineProperty(global, "Notification", {
      writable: true,
      value: { permission: "default", requestPermission },
    })
    const permissionsQuery = jest.fn().mockResolvedValue({ state: "prompt" })
    ;(navigator as any).permissions = { query: permissionsQuery }
    const getUserMedia = jest.fn().mockResolvedValue({})
    ;(navigator.mediaDevices as any) = { getUserMedia }
    const play = jest.fn().mockResolvedValue(undefined)
    const pause = jest.fn()
    ;(global as any).Audio = jest.fn(() => ({ play, pause, currentTime: 0 }))
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
