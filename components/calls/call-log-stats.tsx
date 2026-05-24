"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/calls/format";

export default function CallLogStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["calls-stats"],
    queryFn: async () => {
      const response = await fetch("/api/calls/stats");
      if (!response.ok) throw new Error("Failed to fetch call stats");
      return response.json() as Promise<{ ok: boolean; stats: { callsToday: number; talkTimeTodaySeconds: number; connectedRateToday: number; missedToday: number } }>;
    },
  });

  const stats = data?.stats;
  const cards = [
    ["Calls today", stats?.callsToday ?? 0],
    ["Talk time", formatDuration(stats?.talkTimeTodaySeconds)],
    ["Connected", `${Math.round((stats?.connectedRateToday ?? 0) * 100)}%`],
    ["Missed", stats?.missedToday ?? 0],
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => (
        <Card key={String(label)}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-20" /> : <p className={`font-mono text-2xl font-semibold ${label === "Missed" ? "text-destructive" : ""}`}>{value}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
