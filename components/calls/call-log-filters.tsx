"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DateRangeValue = "today" | "yesterday" | "this_week" | "this_month" | "all" | "custom";

export interface CallLogFiltersValue {
  search: string;
  direction: "all" | "inbound" | "outbound";
  range: DateRangeValue;
  customDateFrom: string;
  customDateTo: string;
}

export default function CallLogFilters({ value, onChange }: { value: CallLogFiltersValue; onChange: (v: CallLogFiltersValue) => void }) {
  const [search, setSearch] = useState(value.search);

  useEffect(() => {
    setSearch(value.search);
  }, [value.search]);

  useEffect(() => {
    const timer = setTimeout(() => onChange({ ...value, search }), 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative min-w-60 flex-1">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-9" placeholder="Search by name or number" />
      </div>
      <Select value={value.direction} onValueChange={(direction: CallLogFiltersValue["direction"]) => onChange({ ...value, direction })}>
        <SelectTrigger className="h-9 w-full md:w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All directions</SelectItem>
          <SelectItem value="inbound">Inbound</SelectItem>
          <SelectItem value="outbound">Outbound</SelectItem>
        </SelectContent>
      </Select>
      <Select value={value.range} onValueChange={(range: DateRangeValue) => onChange({ ...value, range })}>
        <SelectTrigger className="h-9 w-full md:w-[170px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="yesterday">Yesterday</SelectItem>
          <SelectItem value="this_week">This week</SelectItem>
          <SelectItem value="this_month">This month</SelectItem>
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>
      {value.range === "custom" ? (
        <>
          <Input type="date" className="h-9 w-full md:w-[170px]" value={value.customDateFrom} onChange={(e) => onChange({ ...value, customDateFrom: e.target.value })} />
          <Input type="date" className="h-9 w-full md:w-[170px]" value={value.customDateTo} onChange={(e) => onChange({ ...value, customDateTo: e.target.value })} />
        </>
      ) : null}
    </div>
  );
}
