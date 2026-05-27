"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Phone, RefreshCw } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import CallLogFilters, { CallLogFiltersValue } from "@/components/calls/call-log-filters";
import CallLogTable, { CallRow } from "@/components/calls/call-log-table";
import { contactName, externalNumber, formatPhone, relativeCallTime } from "@/lib/calls/format";
import { useCall } from "@/components/voice/CallProvider";

const APP_TIMEZONE = "America/New_York";

function zonedIso(range: "today" | "yesterday" | "this_week" | "this_month"): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  const zone = new Date(now.toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
  const start = new Date(zone);
  if (range === "today") start.setHours(0, 0, 0, 0);
  if (range === "yesterday") start.setHours(0, 0, 0, 0), start.setDate(start.getDate() - 1);
  if (range === "this_week") start.setHours(0, 0, 0, 0), start.setDate(start.getDate() - start.getDay());
  if (range === "this_month") start.setHours(0, 0, 0, 0), start.setDate(1);
  const offsetMs = now.getTime() - zone.getTime();
  const dateFrom = new Date(start.getTime() + offsetMs).toISOString();
  if (range === "yesterday") {
    const endLocal = new Date(start);
    endLocal.setDate(endLocal.getDate() + 1);
    return { dateFrom, dateTo: new Date(endLocal.getTime() + offsetMs).toISOString() };
  }
  return { dateFrom };
}

export default function CallsPage() {
  const [filters, setFilters] = useState<CallLogFiltersValue>({ search: "", direction: "all", range: "today", customDateFrom: "", customDateTo: "" });
  const [statusFilter, setStatusFilter] = useState<"all" | "voicemail" | "missed">("all");
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<CallRow | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { makeCall } = useCall();

  useEffect(() => setPage(1), [filters]);

  const rangeParams = useMemo(() => {
    if (filters.range === "all") return {};
    if (filters.range === "custom") {
      return {
        dateFrom: filters.customDateFrom ? new Date(`${filters.customDateFrom}T00:00:00`).toISOString() : undefined,
        dateTo: filters.customDateTo ? new Date(`${filters.customDateTo}T23:59:59`).toISOString() : undefined,
      };
    }
    return zonedIso(filters.range);
  }, [filters]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["calls-history", filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "25", sortBy: "started_at", sortOrder: "desc" });
      if (rangeParams.dateFrom) params.set("dateFrom", rangeParams.dateFrom);
      if (rangeParams.dateTo) params.set("dateTo", rangeParams.dateTo);
      if (filters.search) params.set("search", filters.search);
      if (filters.direction !== "all") params.set("direction", filters.direction);
      const response = await fetch(`/api/calls/history?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch calls");
      return response.json() as Promise<{ calls: CallRow[]; pagination: { page: number; totalPages: number; hasPrev: boolean; hasNext: boolean; total: number } }>;
    },
  });

  const { data: statsData } = useQuery({ queryKey: ["calls-stats"], queryFn: async () => (await fetch("/api/calls/stats")).json() as Promise<{ stats: { callsToday: number; talkTimeTodaySeconds: number; missedToday: number; newVoicemails: number } }> });

  const filteredCalls = useMemo(() => {
    const needle = filters.search.toLowerCase().trim();
    return (data?.calls ?? []).filter((call) => {
      const name = `${call.buyer?.fname ?? ""} ${call.buyer?.lname ?? ""}`.toLowerCase();
      const nameMatch = !needle || name.includes(needle);
      const statusMatch = statusFilter === "all" ? true : (call.status ?? "").toLowerCase() === statusFilter;
      return nameMatch && statusMatch;
    });
  }, [data?.calls, filters.search, statusFilter]);

  useEffect(() => {
    if (error) toast({ title: "Error", description: "Could not load calls.", variant: "destructive" });
  }, [error, toast]);

  const selectedRecent = useMemo(() => {
    if (!selectedCall) return [];
    return filteredCalls.filter((c) => c.id !== selectedCall.id && (selectedCall.buyer_id ? c.buyer_id === selectedCall.buyer_id : externalNumber(c) === externalNumber(selectedCall))).slice(0, 4);
  }, [filteredCalls, selectedCall]);

  return (
    <MainLayout>
      <div className="mx-auto max-w-[1400px] space-y-4 px-6 py-8">
        <div className="flex items-start justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Calls</h1><p className="text-sm text-muted-foreground">Every call, recording, and voicemail.</p></div><Button variant="outline" onClick={() => { queryClient.invalidateQueries({ queryKey: ["calls-history"] }); queryClient.invalidateQueries({ queryKey: ["calls-stats"] }); }}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh</Button></div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { key: "all", label: "Calls today", value: statsData?.stats?.callsToday ?? 0, tone: "emerald" },
            { key: "all", label: "Talk time", value: `${Math.floor((statsData?.stats?.talkTimeTodaySeconds ?? 0) / 60)}m`, tone: "emerald" },
            { key: "voicemail", label: "New voicemails", value: statsData?.stats?.newVoicemails ?? 0, tone: "purple" },
            { key: "missed", label: "Missed", value: statsData?.stats?.missedToday ?? 0, tone: "red" },
          ].map((card) => {
            const active = (card.key === "all" && statusFilter === "all") || statusFilter === card.key;
            return <button key={card.label} onClick={() => setStatusFilter(active ? "all" : (card.key as "all" | "voicemail" | "missed"))}><Card className={`text-left ${active ? "ring-2 ring-emerald-500 bg-emerald-50" : ""} ${card.tone === "purple" ? "data-[active=true]:ring-purple-500" : ""}`}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{card.label}</CardTitle></CardHeader><CardContent><p className={`font-mono text-2xl font-semibold ${card.tone === "purple" ? "text-purple-700" : card.tone === "red" ? "text-red-600" : "text-emerald-700"}`}>{card.value}</p></CardContent></Card></button>;
          })}
        </div>

        <CallLogFilters value={filters} onChange={setFilters} />

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <CallLogTable calls={filteredCalls} loading={isLoading} pagination={data?.pagination} setPage={setPage} selectedId={selectedCall?.id ?? null} onSelect={setSelectedCall} />
          <Card className="h-fit">
            <CardHeader><CardTitle>Call detail</CardTitle></CardHeader>
            <CardContent>
              {!selectedCall ? <p className="text-sm text-muted-foreground">Select a call to view detail.</p> : <div className="space-y-4">
                <div>
                  <p className="font-semibold">{contactName(selectedCall)}</p>
                  <p className="text-sm text-muted-foreground">{formatPhone(externalNumber(selectedCall))}</p>
                  {selectedCall.buyer?.id ? <Link href={`/buyers/${selectedCall.buyer.id}`} className="mt-1 inline-flex items-center gap-1 text-sm text-emerald-700">View buyer <ArrowUpRight className="h-3.5 w-3.5" /></Link> : null}
                </div>
                <Button className="w-full bg-[#059669] hover:bg-[#047857]" onClick={() => makeCall(selectedCall.direction === "inbound" ? selectedCall.from_number ?? "" : selectedCall.to_number ?? "", selectedCall.buyer?.id ?? undefined)}>Call back</Button>
                {selectedCall.telnyx_recording_id || selectedCall.recording_url || selectedCall.voicemail_storage_path ? <audio controls className="w-full" src={selectedCall.call_sid ? `/api/recordings/${selectedCall.call_sid}/stream` : selectedCall.recording_url ?? selectedCall.voicemail_storage_path ?? undefined} /> : null}
                <div>
                  <p className="mb-2 text-sm font-medium">Recent with this contact</p>
                  <div className="space-y-2">
                    {selectedRecent.map((call) => <div key={call.id} className="rounded-md border p-2 text-sm"><p>{relativeCallTime(call.started_at)}</p><p className="text-muted-foreground">{call.status}</p></div>)}
                    {selectedRecent.length === 0 ? <p className="text-sm text-muted-foreground">No recent calls in this view.</p> : null}
                  </div>
                </div>
              </div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
