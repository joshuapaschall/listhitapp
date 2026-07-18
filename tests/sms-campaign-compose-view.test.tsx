import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import SmsCampaignComposeView from "@/components/campaigns/sms-campaign-compose-view"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => ({ get: () => null }) }))
vi.mock("@/services/buyer-service", () => ({ BuyerService: { getBuyersByIds: vi.fn().mockResolvedValue([]) } }))
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ loading: false, role: "user", isAdmin: false, can: (key: string) => key === "campaigns.send_sms" }),
}))

describe("SmsCampaignComposeView", () => {
  const initialCampaign = { id: "1", status: "draft", name: "SMS", buyer_ids: [], group_ids: [], message: "", media_url: null }

  it("renders core cards", () => {
    render(<SmsCampaignComposeView initialCampaign={initialCampaign} />)
    expect(screen.getByText("To")).toBeTruthy()
    expect(screen.getByText("From")).toBeTruthy()
    expect(screen.getByText("Content")).toBeTruthy()
    // Media was folded into the Content card; Property remains its own card.
    expect(screen.getByText("Property")).toBeTruthy()
    expect(screen.getByText("Send time")).toBeTruthy()
  })

  it("disables send test without phone", () => {
    render(<SmsCampaignComposeView initialCampaign={initialCampaign} />)
    expect(screen.getByRole("button", { name: /send test/i })).toBeDisabled()
  })
})
