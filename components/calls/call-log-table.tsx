"use client";

import { ArrowDownLeft, ArrowUpRight, Phone } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { contactName, externalNumber, formatDuration, formatPhone, relativeCallTime, CallLike } from "@/lib/calls/format";
import CallStatusBadge from "@/components/calls/call-status-badge";

export interface CallRow extends CallLike {
  id: string;
  buyer_id?: string | null;
  status?: string | null;
  duration_seconds?: number | null;
  telnyx_recording_id?: string | null;
  recording_url?: string | null;
  voicemail_storage_path?: string | null;
  call_sid?: string | null;
}

interface PaginationMeta { page: number; totalPages: number; hasPrev: boolean; hasNext: boolean; total: number }

export default function CallLogTable({ calls, loading, pagination, setPage, selectedId, onSelect }: { calls: CallRow[]; loading: boolean; pagination?: PaginationMeta; setPage: (page: number) => void; selectedId: string | null; onSelect: (call: CallRow) => void }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card">
      <div className="divide-y">
        {loading ? Array.from({ length: 8 }).map((_, idx) => <div className="p-4" key={idx}><Skeleton className="h-16 w-full" /></div>) : null}
        {!loading && calls.length === 0 ? <div className="py-16 text-center text-muted-foreground"><Phone className="mx-auto mb-2 h-8 w-8" />No calls match your filters</div> : null}
        {!loading && calls.map((call) => {
          const name = contactName(call);
          const initials = name.split(" ").map((x) => x[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
          const isActive = selectedId === call.id;

          return (
            <button key={call.id} type="button" onClick={() => onSelect(call)} className={`flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-muted/30 ${isActive ? "bg-emerald-50/70 ring-1 ring-emerald-500" : ""}`}>
              <div className="flex min-w-0 items-center gap-3">
                {call.direction === "inbound" ? <ArrowDownLeft className="h-5 w-5 shrink-0 text-emerald-600" /> : <ArrowUpRight className="h-5 w-5 shrink-0 text-blue-600" />}
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{call.buyer ? initials : <Phone className="h-4 w-4" />}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{call.buyer ? name : formatPhone(externalNumber(call))}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatPhone(externalNumber(call))}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CallStatusBadge status={call.status} />
                <p className="hidden w-14 text-right font-mono text-sm md:block">{formatDuration(call.duration_seconds)}</p>
                <p className="hidden w-20 text-right text-xs text-muted-foreground md:block">{relativeCallTime(call.started_at)}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="border-t px-4 py-3">
        <Pagination className="justify-between"><div className="text-sm text-muted-foreground">{pagination?.total ?? 0} calls</div><PaginationContent><PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (pagination?.hasPrev) setPage(pagination.page - 1); }} className={!pagination?.hasPrev ? "pointer-events-none opacity-50" : ""} /></PaginationItem><PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (pagination?.hasNext) setPage(pagination.page + 1); }} className={!pagination?.hasNext ? "pointer-events-none opacity-50" : ""} /></PaginationItem></PaginationContent></Pagination>
      </div>
    </div>
  );
}
