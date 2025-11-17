import { Card } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface KpiCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  iconClass?: string
  tooltip?: string
  delta?: number
}

export default function KpiCard({
  title,
  value,
  icon: Icon,
  iconClass = "text-muted-foreground",
  tooltip,
  delta,
}: KpiCardProps) {
  const display = typeof value === "number" ? value.toLocaleString() : value
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        {tooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-sm text-muted-foreground">{title}</div>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="text-sm text-muted-foreground">{title}</div>
        )}
        <div className="text-2xl font-bold flex items-center">
          {display}
          {delta !== undefined && (
            <Badge
              className={`ml-2 ${
                delta >= 0
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {delta >= 0 ? "↑" : "↓"}
            </Badge>
          )}
        </div>
      </div>
      <Icon className={`h-6 w-6 ${iconClass}`} />
    </Card>
  )
}
