import { Ban } from "lucide-react"
import KpiCard from "./KpiCard"

export default function SmsUnsubscribesCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="SMS Unsubscribes"
      value={value}
      icon={Ban}
      iconClass="text-red-600"
      tooltip="Contacts who opted out of SMS."
    />
  )
}
