import { AlertCircle } from "lucide-react"
import KpiCard from "./KpiCard"

export default function SpamComplaintRateCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Spam Complaint Rate"
      value={`${value}%`}
      icon={AlertCircle}
      iconClass="text-red-600"
      tooltip="Percentage of emails marked as spam."
    />
  )
}
