import { MessageSquare } from "lucide-react"
import KpiCard from "./KpiCard"

export default function TextsSentCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Texts Sent"
      value={value}
      icon={MessageSquare}
      iconClass="text-blue-600"
      tooltip="Outgoing text messages sent."
    />
  )
}
