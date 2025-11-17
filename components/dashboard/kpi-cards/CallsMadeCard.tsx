import { Phone } from "lucide-react"
import KpiCard from "./KpiCard"

export default function CallsMadeCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Calls Made"
      value={value}
      icon={Phone}
      iconClass="text-blue-600"
      tooltip="Outbound calls made."
    />
  )
}
