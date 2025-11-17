import { PlayCircle } from "lucide-react"
import KpiCard from "./KpiCard"

export default function CampaignsRunningCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Campaigns Running"
      value={value}
      icon={PlayCircle}
      tooltip="Active marketing campaigns."
    />
  )
}
