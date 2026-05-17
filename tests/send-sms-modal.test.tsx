/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react"
import SendSmsModal from "../components/buyers/send-sms-modal"
import { ALLOWED_MMS_EXTENSIONS, MAX_MMS_SIZE } from "../utils/uploadMedia"

// jsdom doesn't implement createObjectURL
// @ts-ignore
global.URL.createObjectURL = vi.fn(() => "blob:mock")

vi.mock("../services/template-service", () => ({
  TemplateService: { listTemplates: vi.fn().mockResolvedValue([]), addTemplate: vi.fn() }
}))

vi.mock("../services/prompt-service", () => ({
  PromptService: { listPrompts: vi.fn().mockResolvedValue([]) }
}))


var uploadMock: vi.Mock
vi.mock("../utils/uploadMedia", async () => {
  uploadMock = vi.fn().mockResolvedValue("https://cdn/p")
  const actual = await vi.importActual<typeof import("../utils/uploadMedia")>("../utils/uploadMedia")
  return { ...actual, uploadMediaFile: (...args: any[]) => uploadMock(...args) }
})

vi.mock("../services/campaign-service", () => ({
  default: {
    createCampaign: vi.fn().mockResolvedValue({ id: "c1" }),
    sendNow: vi.fn().mockResolvedValue({}),
  }
}))

vi.mock("sonner", () => {
  const toast = { success: vi.fn(), error: vi.fn() }
  return { toast }
})

describe("SendSmsModal", () => {
  test("limits message length", () => {
    const buyer = { id: "b1", fname: "John", lname: "Doe" } as any
    render(<SendSmsModal open={true} onOpenChange={() => {}} buyer={buyer} />)
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "a".repeat(400) } })
    expect(textarea.value.length).toBe(320)
  })

  test("file input allows multiple formats", () => {
    const buyer = { id: "b1" } as any
    render(<SendSmsModal open={true} onOpenChange={() => {}} buyer={buyer} />)
    const input = document.querySelector("input[type=\"file\"]") as HTMLInputElement
    expect(input.getAttribute("accept")).toBe(ALLOWED_MMS_EXTENSIONS.join(","))
  })

  const exts = ALLOWED_MMS_EXTENSIONS

  test.each(exts)("uploads %s files", async (ext) => {
    const buyer = { id: "b1" } as any
    render(<SendSmsModal open={true} onOpenChange={() => {}} buyer={buyer} />)
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "Hi" } })
    const fileInput = document.querySelector("input[type=\"file\"]") as HTMLInputElement
    const file = new File(["data"], `test${ext}`, { type: "application/octet-stream" })
    fireEvent.change(fileInput, { target: { files: [file] } })
    const send = screen.getByRole("button", { name: /send/i })
    fireEvent.click(send)
    expect(uploadMock).toHaveBeenCalledWith(file, "outgoing")
    uploadMock.mockClear()
  })

  test("shows warning and disables send for oversized files", () => {
    const buyer = { id: "b1" } as any
    render(<SendSmsModal open={true} onOpenChange={() => {}} buyer={buyer} />)
    const fileInput = document.querySelector("input[type=\"file\"]") as HTMLInputElement
    const big = new File([new Uint8Array(MAX_MMS_SIZE + 1)], "big.jpg", { type: "image/jpeg" })
    fireEvent.change(fileInput, { target: { files: [big] } })
    const send = screen.getByRole("button", { name: /send/i })
    expect(send.getAttribute("disabled")).not.toBeNull()
    expect(screen.getByText(/over 1MB/i)).toBeTruthy()
  })
})
