"use client";

import { ArrowDownLeft, ArrowUpRight, Phone, Play } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { contactName, externalNumber, formatDuration, formatPhone, ownedNumber, relativeCallTime, CallLike } from "@/lib/calls/format";
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

// Shared grid template so the header and every row align column-for-column.
const ROW_GRID = "grid grid-cols-[24px_1fr_auto] md:grid-cols-[24px_1fr_110px_64px_32px_72px] items-center gap-3";

export default function CallLogTable({ calls, loading, pagination, setPage, selectedId, onSelect }: { calls: CallRow[]; loading: boolean; pagination?: PaginationMeta; setPage: (page: number) => void; selectedId: string | null; onSelect: (call: CallRow) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className={`hidden md:grid ${ROW_GRID} border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground`}>
        <span />
        <span>Contact</span>
        <span>Status</span>
        <span className="text-right">Duration</span>
        <span />
        <span className="text-right">Time</span>
      </div>

      <div>
        {loading ? Array.from({ length: 8 }).map((_, idx) => <div className="px-4 py-3" key={idx}><Skeleton className="h-12 w-full" /></div>) : null}
        {!loading && calls.length === 0 ? <div className="py-16 text-center text-muted-foreground"><Phone className="mx-auto mb-2 h-8 w-8" />No calls match your filters</div> : null}
        {!loading && calls.map((call) => {
          const name = contactName(call);
          const initials = name.split(" ").map((x) => x[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
          const isActive = selectedId === call.id;
          const hasRecording = Boolean(call.telnyx_recording_id || call.recording_url || call.voicemail_storage_path);

          return (
            <button
              key={call.id}
              type="button"
              onClick={() => onSelect(call)}
              className={`${ROW_GRID} w-full border-b border-border px-4 py-2.5 text-left transition last:border-0 hover:bg-muted/40 ${isActive ? "bg-brand/5 ring-1 ring-brand" : ""}`}
            >
              {call.direction === "inbound"
                ? <ArrowDownLeft className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                : <ArrowUpRight className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />}

              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback>{call.buyer ? initials : <Phone className="h-4 w-4" />}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{call.buyer ? name : formatPhone(externalNumber(call))}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {formatPhone(externalNumber(call))}
                    {ownedNumber(call) ? <span className="text-muted-foreground/70"> → on {formatPhone(ownedNumber(call))}</span> : null}
                  </p>
                </div>
              </div>

              <div className="justify-self-start"><CallStatusBadge status={call.status} /></div>

              <p className="hidden text-right font-mono text-sm md:block">{formatDuration(call.duration_seconds)}</p>

              <div className="hidden items-center justify-center md:flex">
                {hasRecording ? <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground"><Play className="h-3 w-3" /></span> : null}
              </div>

              <p className="hidden text-right text-xs text-muted-foreground md:block">{relativeCallTime(call.started_at)}</p>
            </button>
          );
        })}
      </div>

      <div className="border-t border-border px-4 py-3">
        <Pagination className="justify-between"><div className="text-sm text-muted-foreground">{pagination?.total ?? 0} calls</div><PaginationContent><PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (pagination?.hasPrev) setPage(pagination.page - 1); }} className={!pagination?.hasPrev ? "pointer-events-none opacity-50" : ""} /></PaginationItem><PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (pagination?.hasNext) setPage(pagination.page + 1); }} className={!pagination?.hasNext ? "pointer-events-none opacity-50" : ""} /></PaginationItem></PaginationContent></Pagination>
      </div>
    </div>
  );
}
