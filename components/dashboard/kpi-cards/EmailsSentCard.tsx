import { Mail } from "lucide-react"
import KpiCard from "./KpiCard"

export default function EmailsSentCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Emails Sent"
      value={value}
      icon={Mail}
      iconClass="text-blue-600"
      tooltip="Emails sent to contacts."
    />
  )
}
