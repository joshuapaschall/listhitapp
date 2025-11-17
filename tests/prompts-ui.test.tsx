/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react"
import PromptForm from "../components/prompts/prompt-form"

describe("PromptForm", () => {
  test("submits entered data", async () => {
    const handleSubmit = jest.fn().mockResolvedValue(undefined)
    render(<PromptForm onSubmit={handleSubmit} />)
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "Test" } })
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: "Desc" } })
    fireEvent.change(screen.getByLabelText(/Prompt/i), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    await screen.findByRole("button", { name: /save/i })
    expect(handleSubmit).toHaveBeenCalledWith({ name: "Test", description: "Desc", prompt: "Hello" })
  })
})
