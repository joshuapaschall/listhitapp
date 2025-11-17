import { FileText } from "lucide-react"
import KpiCard from "./KpiCard"

export default function OffersCreatedCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Offers Created"
      value={value}
      icon={FileText}
      tooltip="Offers created in the selected period."
    />
  )
}
