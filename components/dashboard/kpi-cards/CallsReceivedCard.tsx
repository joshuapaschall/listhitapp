import { Phone } from "lucide-react"
import KpiCard from "./KpiCard"

export default function CallsReceivedCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Calls Received"
      value={value}
      icon={Phone}
      iconClass="text-blue-600"
      tooltip="Inbound calls received."
    />
  )
}
