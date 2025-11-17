import { Ban } from "lucide-react"
import KpiCard from "./KpiCard"

export default function EmailUnsubscribesCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Email Unsubscribes"
      value={value}
      icon={Ban}
      iconClass="text-red-600"
      tooltip="Contacts who unsubscribed from email."
    />
  )
}
