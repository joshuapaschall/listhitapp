/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react"
import SmsCampaignModal from "../components/campaigns/sms-campaign-modal"
import { toast } from "sonner"
import { ALLOWED_MMS_EXTENSIONS } from "../utils/uploadMedia"

// jsdom doesn't implement createObjectURL
// @ts-ignore
global.URL.createObjectURL = vi.fn(() => "blob:mock")

var uploadMock: vi.Mock
vi.mock("../utils/uploadMedia", async () => {
  uploadMock = vi.fn().mockResolvedValue("https://cdn/p")
  const actual = await vi.importActual<typeof import("../utils/uploadMedia")>("../utils/uploadMedia")
  return { ...actual, uploadMediaFile: (...args: any[]) => uploadMock(...args) }
})

vi.mock("../lib/group-service", () => ({
  getGroups: vi.fn().mockResolvedValue([])
}))

vi.mock("../services/buyer-service", () => ({
  BuyerService: {
    getBuyerIdsForGroups: vi.fn().mockResolvedValue([]),
    getBuyerCountsByGroup: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock("../services/template-service", () => ({
  TemplateService: { listTemplates: vi.fn().mockResolvedValue([]), addTemplate: vi.fn() }
}))

vi.mock("../services/prompt-service", () => ({
  PromptService: { listPrompts: vi.fn().mockResolvedValue([]) }
}))

vi.mock("../components/chat-assistant-button", () => ({
  __esModule: true,
  default: ({ onInsert }: { onInsert?: (text: string) => void }) => (
    <button onClick={() => onInsert && onInsert("AI text")}>AI Assistant</button>
  ),
}))


vi.mock("sonner", () => {
  const toast = { success: vi.fn(), error: vi.fn() }
  return { toast }
})

describe("SmsCampaignModal", () => {
  test("navigates steps and marks completion", async () => {
    render(<SmsCampaignModal open={true} onOpenChange={() => {}} />)
    const next = screen.getByRole("button", { name: /next/i })
    const recipients = screen.getByRole("tab", { name: /recipients/i })
    expect(recipients.getAttribute("data-state")).toBe("active")
    fireEvent.click(next)
    const message = await screen.findByRole("tab", { name: /message/i })
    expect(message.getAttribute("data-state")).toBe("active")
    expect(recipients.getAttribute("data-complete")).toBe("true")
  })

  test("blocks unsupported files", async () => {
    render(<SmsCampaignModal open={true} onOpenChange={() => {}} />)
    const nameInput = screen.getAllByRole("textbox")[0] as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: "Test" } })
    const next = screen.getByRole("button", { name: /next/i })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /message/i })
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "Hi" } })
    const fileInput = document.querySelector("input[type=\"file\"]") as HTMLInputElement
    const file = new File(["data"], "bad.txt", { type: "text/plain" })
    fireEvent.change(fileInput, { target: { files: [file] } })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /preview/i })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /schedule/i })
    const send = screen.getByRole("button", { name: /send now/i })
    fireEvent.click(send)
    expect(toast.error).toHaveBeenCalled()
    expect(uploadMock).not.toHaveBeenCalled()
  })

  test("file input accept attribute matches allowed types", async () => {
    render(<SmsCampaignModal open={true} onOpenChange={() => {}} />)
    const next = screen.getByRole("button", { name: /next/i })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /message/i })
    const input = document.querySelector("input[type=\"file\"]") as HTMLInputElement
    expect(input.getAttribute("accept")).toBe(ALLOWED_MMS_EXTENSIONS.join(","))
  })

  test("renders AI assistant button", async () => {
    render(<SmsCampaignModal open={true} onOpenChange={() => {}} />)
    const next = screen.getByRole("button", { name: /next/i })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /message/i })
    expect(screen.getByRole("button", { name: /ai assistant/i })).toBeTruthy()
  })

  test("AI assistant inserts SMS body", async () => {
    const aiCb = vi.fn()
    render(
      <SmsCampaignModal open={true} onOpenChange={() => {}} onAiInsert={aiCb} />,
    )
    const nameInput = screen.getAllByRole("textbox")[0] as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: "Test" } })
    const next = screen.getByRole("button", { name: /next/i })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /message/i })
    fireEvent.click(screen.getByText(/ai assistant/i))
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement
    expect(textarea.value).toBe("AI text")
    expect(aiCb).toHaveBeenCalledWith("AI text")
  })

  const exts = ALLOWED_MMS_EXTENSIONS

  test.each(exts)("uploads %s files", async (ext) => {
    render(<SmsCampaignModal open={true} onOpenChange={() => {}} />)
    const nameInput = screen.getAllByRole("textbox")[0] as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: "Test" } })
    const next = screen.getByRole("button", { name: /next/i })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /message/i })
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "Hi" } })
    const fileInput = document.querySelector("input[type=\"file\"]") as HTMLInputElement
    const file = new File(["data"], `test${ext}`, { type: "application/octet-stream" })
    fireEvent.change(fileInput, { target: { files: [file] } })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /preview/i })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /schedule/i })
    const send = screen.getByRole("button", { name: /send now/i })
    fireEvent.click(send)
    expect(uploadMock).toHaveBeenCalledWith(file, "outgoing")
    uploadMock.mockClear()
  })
})
