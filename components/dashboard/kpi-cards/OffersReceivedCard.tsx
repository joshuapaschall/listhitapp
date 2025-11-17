import { FileText } from "lucide-react"
import KpiCard from "./KpiCard"

export default function OffersReceivedCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Offers Received"
      value={value}
      icon={FileText}
      tooltip="Offers received from buyers."
    />
  )
}
