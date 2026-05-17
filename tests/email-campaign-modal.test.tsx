/** @jest-environment jsdom */
import { render, screen, fireEvent, act } from "@testing-library/react"
import NewEmailCampaignModal from "../components/campaigns/NewEmailCampaignModal"

vi.mock("react-quill", () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

vi.mock("../lib/group-service", () => ({
  getGroups: vi.fn().mockResolvedValue([])
}))

vi.mock("../services/buyer-service", () => ({
  BuyerService: {
    getBuyerIdsForGroups: vi.fn().mockResolvedValue([]),
    getBuyerCountsByGroup: vi.fn().mockResolvedValue({}),
    getTags: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock("../services/campaign-service", () => ({
  CampaignService: {
    createCampaign: vi.fn().mockResolvedValue({ id: "c1" }),
    sendNow: vi.fn().mockResolvedValue(undefined),
    schedule: vi.fn(),
  },
}))

vi.mock("../components/chat-assistant-button", () => ({
  __esModule: true,
  default: ({ onInsert }: { onInsert?: (text: string) => void }) => (
    <button onClick={() => onInsert && onInsert("AI text")}>AI Assistant</button>
  ),
}))

describe("EmailCampaignModal", () => {
  beforeEach(() => {
    ;(global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 1, sample: [] }),
    })
  })

  test("navigates steps and shows actions", async () => {
    render(<NewEmailCampaignModal open={true} onOpenChange={() => {}} />)
    const next = screen.getByRole("button", { name: /next/i })
    const recipients = screen.getByRole("tab", { name: /recipients/i })
    expect(recipients.getAttribute("data-state")).toBe("active")
    fireEvent.click(next)
    const message = await screen.findByRole("tab", { name: /message/i })
    expect(message.getAttribute("data-state")).toBe("active")
    expect(recipients.getAttribute("data-complete")).toBe("true")
    expect(screen.getByRole("button", { name: /send test/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: /preview/i })).toBeTruthy()
  })

  test("shows AI assistant button", async () => {
    render(<NewEmailCampaignModal open={true} onOpenChange={() => {}} />)
    const next = screen.getByRole("button", { name: /next/i })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /message/i })
    expect(screen.getByRole("button", { name: /ai assistant/i })).toBeTruthy()
  })

  test("AI assistant inserts email body", async () => {
    const aiCb = vi.fn()
    render(
      <NewEmailCampaignModal
        open={true}
        onOpenChange={() => {}}
        onAiInsert={aiCb}
      />,
    )
    const next = screen.getByRole("button", { name: /next/i })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /message/i })
    fireEvent.click(screen.getByText(/ai assistant/i))
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement
    expect(textarea.value).toBe("AI text")
    expect(aiCb).toHaveBeenCalledWith("AI text")
  })

  test("submits filters to campaign service", async () => {
    vi.useFakeTimers()
    const { CampaignService } = require("../services/campaign-service")
    render(<NewEmailCampaignModal open={true} onOpenChange={() => {}} />)
    const nameInput = screen.getByLabelText(/campaign name/i)
    fireEvent.change(nameInput, { target: { value: "Test" } })
    const minScoreInput = screen.getByLabelText(/min score/i)
    fireEvent.change(minScoreInput, { target: { value: "50" } })
    act(() => {
      vi.runAllTimers()
    })
    const next = screen.getByRole("button", { name: /next/i })
    fireEvent.click(next)
    await screen.findByRole("tab", { name: /message/i })
    const subjectInput = screen.getByLabelText(/subject/i)
    fireEvent.change(subjectInput, { target: { value: "Hello" } })
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "Body" } })
    const sendBtn = screen.getByRole("button", { name: /send now/i })
    fireEvent.click(sendBtn)
    expect(CampaignService.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ minScore: 50 }),
      }),
    )
    vi.useRealTimers()
  })
})
