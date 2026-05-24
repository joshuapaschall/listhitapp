"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DateRangeValue = "today" | "last_7" | "last_30";

export interface CallLogFiltersValue {
  search: string;
  direction: "all" | "inbound" | "outbound";
  hasRecording: "all" | "true" | "false";
  range: DateRangeValue;
}

export default function CallLogFilters({ value, onChange }: { value: CallLogFiltersValue; onChange: (v: CallLogFiltersValue) => void }) {
  const [search, setSearch] = useState(value.search);

  useEffect(() => {
    const timer = setTimeout(() => onChange({ ...value, search }), 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative min-w-60 flex-1 md:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-9" placeholder="Search phone number" />
      </div>
      <Select value={value.direction} onValueChange={(direction: CallLogFiltersValue["direction"]) => onChange({ ...value, direction })}>
        <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="all">All directions</SelectItem><SelectItem value="inbound">Inbound</SelectItem><SelectItem value="outbound">Outbound</SelectItem>
        </SelectContent>
      </Select>
      <Select value={value.hasRecording} onValueChange={(hasRecording: CallLogFiltersValue["hasRecording"]) => onChange({ ...value, hasRecording })}>
        <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="all">All recordings</SelectItem><SelectItem value="true">With recording</SelectItem><SelectItem value="false">Without recording</SelectItem>
        </SelectContent>
      </Select>
      <Select value={value.range} onValueChange={(range: DateRangeValue) => onChange({ ...value, range })}>
        <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="today">Today</SelectItem><SelectItem value="last_7">7 days</SelectItem><SelectItem value="last_30">30 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
