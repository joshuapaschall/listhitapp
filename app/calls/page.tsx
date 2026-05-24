"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import CallLogFilters, { CallLogFiltersValue } from "@/components/calls/call-log-filters";
import CallLogStats from "@/components/calls/call-log-stats";
import CallLogTable, { CallRow } from "@/components/calls/call-log-table";

export default function CallsPage() {
  const [filters, setFilters] = useState<CallLogFiltersValue>({ search: "", direction: "all", hasRecording: "all", range: "today" });
  const [page, setPage] = useState(1);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => setPage(1), [filters]);

  const dateFrom = useMemo(() => {
    const now = new Date();
    if (filters.range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    if (filters.range === "last_7") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }, [filters.range]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["calls-history", filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "25", sortBy: "started_at", sortOrder: "desc", dateFrom });
      if (filters.search) params.set("search", filters.search);
      if (filters.direction !== "all") params.set("direction", filters.direction);
      if (filters.hasRecording !== "all") params.set("hasRecording", filters.hasRecording);
      const response = await fetch(`/api/calls/history?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch calls");
      return response.json() as Promise<{ calls: CallRow[]; pagination: { page: number; totalPages: number; hasPrev: boolean; hasNext: boolean; total: number } }>;
    },
  });

  useEffect(() => {
    if (error) {
      toast({ title: "Error", description: "Could not load calls.", variant: "destructive" });
    }
  }, [error, toast]);

  return (
    <MainLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <div><h1 className="text-3xl font-semibold tracking-tight">Calls</h1><p className="mt-1 text-sm text-muted-foreground">Review all inbound and outbound activity, recordings, and outcomes.</p></div>
          <Button variant="outline" onClick={() => { queryClient.invalidateQueries({ queryKey: ["calls-history"] }); queryClient.invalidateQueries({ queryKey: ["calls-stats"] }); }}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
        <CallLogStats />
        <CallLogFilters value={filters} onChange={setFilters} />
        <CallLogTable calls={data?.calls ?? []} loading={isLoading} pagination={data?.pagination} setPage={setPage} playingId={playingId} setPlayingId={setPlayingId} audioRef={audioRef} />
      </div>
    </MainLayout>
  );
}
