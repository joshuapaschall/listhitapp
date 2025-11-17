/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock
import ComposeModal from "../components/gmail/compose-modal"
import { Thread } from "../lib/mock-emails"

describe("mock email components", () => {
  const threads: Thread[] = [
    {
      id: "t1",
      messages: [
        {
          id: "m1",
          from: "a@test.com",
          to: "b@test.com",
          subject: "Hello",
          body: "Body",
          date: "2024-01-01T00:00:00Z",
        },
      ],
    },
  ]

  test("ComposeModal sends data", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ threadId: "t2" }) })
    const handleSent = jest.fn()
    const handleOpen = jest.fn()
    render(
      <ComposeModal open={true} onOpenChange={handleOpen} onSent={handleSent} />,
    )
    const fields = screen.getAllByRole("textbox")
    fireEvent.change(fields[0], { target: { value: "c@test.com" } })
    fireEvent.change(fields[1], { target: { value: "Sub" } })
    fireEvent.change(fields[2], { target: { value: "Message" } })
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
    await waitFor(() => expect(handleSent).toHaveBeenCalled())
    expect(handleSent).toHaveBeenCalledWith("t2")
    expect(handleOpen).toHaveBeenCalledWith(false)
  })
})
