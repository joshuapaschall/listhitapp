/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react"
import TemplateForm from "../components/templates/template-form"

describe("TemplateForm", () => {
  test("submits entered data", async () => {
    const handleSubmit = jest.fn().mockResolvedValue(undefined)
    render(<TemplateForm channel="sms" onSubmit={handleSubmit} />)
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "Hi" } })
    fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: "Test" } })
    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    await screen.findByRole("button", { name: /save/i })
    expect(handleSubmit).toHaveBeenCalledWith({ name: "Hi", message: "Test" })
  })

  test("does not append stop text for email", async () => {
    const handleSubmit = jest.fn().mockResolvedValue(undefined)
    render(<TemplateForm channel="email" onSubmit={handleSubmit} />)
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "Hi" } })
    fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: "Test" } })
    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    await screen.findByRole("button", { name: /save/i })
    expect(handleSubmit).toHaveBeenCalledWith({ name: "Hi", message: "Test" })
  })
})
