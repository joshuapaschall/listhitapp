import type { RecentActivityItem } from "@/services/dashboard-service"

interface RecentActivityProps {
  items: RecentActivityItem[]
}

export default function RecentActivity({ items }: RecentActivityProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Recent Activity</h2>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={item.id} className="border-b pb-1 last:border-none">
            <span className="font-medium mr-2">{item.description}</span>
            <span className="text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
