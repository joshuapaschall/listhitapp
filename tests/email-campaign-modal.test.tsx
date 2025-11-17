/** @jest-environment jsdom */
import { render, screen, fireEvent, act } from "@testing-library/react"
import NewEmailCampaignModal from "../components/campaigns/NewEmailCampaignModal"

jest.mock("react-quill", () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

jest.mock("../lib/group-service", () => ({
  getGroups: jest.fn().mockResolvedValue([])
}))

jest.mock("../services/buyer-service", () => ({
  BuyerService: {
    getBuyerIdsForGroups: jest.fn().mockResolvedValue([]),
    getBuyerCountsByGroup: jest.fn().mockResolvedValue({}),
    getTags: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock("../services/campaign-service", () => ({
  CampaignService: {
    createCampaign: jest.fn().mockResolvedValue({ id: "c1" }),
    sendNow: jest.fn().mockResolvedValue(undefined),
    schedule: jest.fn(),
  },
}))

jest.mock("../components/chat-assistant-button", () => ({
  __esModule: true,
  default: ({ onInsert }: { onInsert?: (text: string) => void }) => (
    <button onClick={() => onInsert && onInsert("AI text")}>AI Assistant</button>
  ),
}))

describe("EmailCampaignModal", () => {
  beforeEach(() => {
    ;(global as any).fetch = jest.fn().mockResolvedValue({
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
    const aiCb = jest.fn()
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
    jest.useFakeTimers()
    const { CampaignService } = require("../services/campaign-service")
    render(<NewEmailCampaignModal open={true} onOpenChange={() => {}} />)
    const nameInput = screen.getByLabelText(/campaign name/i)
    fireEvent.change(nameInput, { target: { value: "Test" } })
    const minScoreInput = screen.getByLabelText(/min score/i)
    fireEvent.change(minScoreInput, { target: { value: "50" } })
    act(() => {
      jest.runAllTimers()
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
    jest.useRealTimers()
  })
})
