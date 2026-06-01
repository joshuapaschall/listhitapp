/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react"
import SendFoxContactsViewer from "../components/buyers/sendfox-contacts-viewer"

describe("SendFoxContactsViewer", () => {
  test("does not fetch SendFox contacts after integration removal", () => {
    ;(global.fetch as any) = vi.fn()
    render(<SendFoxContactsViewer listId={1} open={true} onOpenChange={() => {}} />)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText("No contacts available.")).toBeTruthy()
  })
})
