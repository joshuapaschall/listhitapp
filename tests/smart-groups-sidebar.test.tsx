/** @jest-environment jsdom */
import { render, screen, waitFor, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import SmartGroupsSidebar from "../components/buyers/smart-groups-sidebar"

jest.mock("../lib/group-service", () => ({
  getGroups: jest.fn(async () => [
    { id: "1", name: "Synced", created_at: "", sendfox_list_id: 5 },
    { id: "2", name: "Local", created_at: "", sendfox_list_id: null },
  ]),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
}))

describe("SmartGroupsSidebar", () => {
  test("shows View Contacts button only for synced groups", async () => {
    render(<SmartGroupsSidebar />)
    await waitFor(() => screen.getByText("Synced"))
    const buttons = screen.getAllByRole("button", { name: /view contacts/i })
    expect(buttons.length).toBe(1)
    const syncedRow = screen.getByText("Synced").closest("div")!.parentElement as HTMLElement
    expect(within(syncedRow).getByRole("button", { name: /view contacts/i })).toBeInTheDocument()
    const localRow = screen.getByText("Local").closest("div")!.parentElement as HTMLElement
    expect(within(localRow).queryByRole("button", { name: /view contacts/i })).toBeNull()
  })
})
