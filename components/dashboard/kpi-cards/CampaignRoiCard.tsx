import { BarChart3 } from "lucide-react"
import KpiCard from "./KpiCard"

export default function CampaignRoiCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Campaign ROI"
      value={`${value}%`}
      icon={BarChart3}
      iconClass="text-green-600"
      tooltip="Return on investment for campaigns."
    />
  )
}
