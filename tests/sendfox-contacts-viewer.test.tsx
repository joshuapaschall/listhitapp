/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react"
import SendFoxContactsViewer from "../components/buyers/sendfox-contacts-viewer"

describe("SendFoxContactsViewer", () => {
  test("fetches and displays contacts", async () => {
    ;(global.fetch as any) = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            email: "a@test.com",
            first_name: "A",
            last_name: "Test",
            status: "active",
            created_at: "2024-01-01T00:00:00Z",
          },
        ]),
    })
    render(<SendFoxContactsViewer listId={1} open={true} onOpenChange={() => {}} />)
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sendfox/lists/1/contacts",
      ),
    )
    await screen.findByText("a@test.com")
    expect(screen.getByText("A Test")).toBeTruthy()
    expect(screen.getByText("active")).toBeTruthy()
    expect(
      screen.getByText(new Date("2024-01-01T00:00:00Z").toLocaleDateString()),
    ).toBeTruthy()
  })
})
