"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Can } from "@/components/auth/Can";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { BuyerService } from "@/services/buyer-service";
import { formatPhoneDisplay, formatPhoneE164 } from "@/lib/dedup-utils";
import { useCall } from "@/components/voice/CallProvider";
import type { Buyer } from "@/lib/supabase";
import { Delete, Loader2, PhoneCall, Search } from "lucide-react";

const CALL_GREEN = "#1DB954";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((response) => response.json());

const KEYS: { d: string; sub: string }[] = [
  { d: "1", sub: "" }, { d: "2", sub: "ABC" }, { d: "3", sub: "DEF" },
  { d: "4", sub: "GHI" }, { d: "5", sub: "JKL" }, { d: "6", sub: "MNO" },
  { d: "7", sub: "PQRS" }, { d: "8", sub: "TUV" }, { d: "9", sub: "WXYZ" },
  { d: "*", sub: "" }, { d: "0", sub: "+" }, { d: "#", sub: "" },
];

const initialsOf = (s: string) =>
  s.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

export function Dialer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { makeCall, status, activeCall, setCurrentContact } = useCall();
  const [search, setSearch] = useState("");
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [searching, setSearching] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [number, setNumber] = useState("");
  const [from, setFrom] = useState("");
  // True only once the user actively changes the caller-ID picker; the auto-shown
  // default is for display and is NOT forced onto the server.
  const [manualFrom, setManualFrom] = useState(false);
  const [dialing, setDialing] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: numbersData } = useSWR(open ? "/api/numbers/list" : null, fetcher);
  const fromItems = useMemo(
    () => (Array.isArray(numbersData?.items) ? (numbersData.items as { e164: string; label?: string }[]) : []),
    [numbersData?.items],
  );

  useEffect(() => {
    if (!open) return;
    const run = async () => {
      setSearching(true);
      try {
        const phonePattern = /^[\d\s()\-+]+$/;
        const results = debouncedSearch
          ? phonePattern.test(debouncedSearch)
            ? await BuyerService.searchBuyers(debouncedSearch.replace(/\D/g, ""))
            : await BuyerService.searchBuyers(debouncedSearch)
          : await BuyerService.listBuyers(10);
        setBuyers(results);
      } finally {
        setSearching(false);
      }
    };
    run();
  }, [debouncedSearch, open]);

  useEffect(() => {
    if (!open || from) return;
    const defaultFrom = typeof numbersData?.defaultFrom === "string" ? numbersData.defaultFrom : "";
    const first = fromItems[0]?.e164 || "";
    if (defaultFrom) setFrom(defaultFrom);
    else if (first) setFrom(first);
  }, [open, from, numbersData?.defaultFrom, fromItems]);

  const busy = status === "connecting" || status === "on-call" || Boolean(activeCall);

  const pressKey = (digit: string) => setNumber((prev) => `${prev}${digit}`);

  const call = async () => {
    const to = formatPhoneE164(number) || number.trim();
    if (!to || busy) return;
    setDialing(true);
    try {
      setCurrentContact({ name: selectedBuyer?.full_name || search || undefined, number: to });
      // Pass `from` only when the user manually picked it; otherwise the server resolves
      // the sticky / default app-assigned caller ID.
      await makeCall(to, selectedBuyer?.id, manualFrom ? (from || undefined) : undefined);
      onOpenChange(false);
      setNumber("");
      setSearch("");
      setSelectedBuyer(null);
      setManualFrom(false);
    } finally {
      setDialing(false);
    }
  };

  return (
    <Can permission="calls.make_receive">
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New call</DialogTitle>
          <DialogDescription>Search a buyer or dial manually.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Buyer search */}
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal text-muted-foreground">
                <Search className="mr-2 h-4 w-4" />
                {selectedBuyer ? (selectedBuyer.full_name || `${selectedBuyer.fname || ""} ${selectedBuyer.lname || ""}`).trim() : "Search buyers"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0" align="start">
              <div className="p-2">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone" />
              </div>
              <Command>
                <CommandList>
                  {searching ? <div className="p-3 text-sm text-muted-foreground">Searching...</div> : null}
                  <CommandEmpty>No buyers found.</CommandEmpty>
                  <CommandGroup>
                    {buyers.map((buyer) => {
                      const name = buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim() || "Unnamed";
                      const phone = buyer.phone || buyer.phone2 || buyer.phone3 || "";
                      return (
                        <CommandItem key={buyer.id} value={`${name} ${phone}`} onSelect={() => {
                          setSelectedBuyer(buyer);
                          setNumber(phone);
                          setPopoverOpen(false);
                        }}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="text-xs">{initialsOf(name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-sm text-foreground">{name}</span>
                              <span className="truncate font-mono text-xs text-muted-foreground">{formatPhoneDisplay(phone) || "No phone"}</span>
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Number readout (editable, also driven by the keypad) */}
          <Input
            id="dial-number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Enter a number"
            aria-label="Number to dial"
            className="h-12 rounded-none border-0 border-b border-border text-center font-mono text-[26px] tracking-wide focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {/* From (sender) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">From</span>
            <Select value={from} onValueChange={(v) => { setFrom(v); setManualFrom(true); }}>
              <SelectTrigger className="h-9 flex-1 font-mono">
                <SelectValue placeholder="Select from number" />
              </SelectTrigger>
              <SelectContent>
                {fromItems.map((item) => (
                  <SelectItem key={item.e164} value={item.e164} className="font-mono">
                    {item.label ? `${item.label} · ${item.e164}` : item.e164}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Sticky sender</span>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map(({ d, sub }) => (
              <button
                key={d}
                type="button"
                onClick={() => pressKey(d)}
                className="flex h-14 flex-col items-center justify-center rounded-xl bg-muted transition-colors hover:bg-muted/70"
              >
                <span className="font-mono text-xl font-medium text-foreground">{d}</span>
                {sub ? <span className="text-[10px] tracking-[0.15em] text-muted-foreground">{sub}</span> : null}
              </button>
            ))}
          </div>

          {/* Action row */}
          <div className="flex items-center justify-center gap-6">
            <span className="w-10" aria-hidden="true" />
            <button
              type="button"
              onClick={call}
              disabled={dialing || busy || !number.trim()}
              aria-label="Call"
              className="flex h-[62px] w-[62px] items-center justify-center rounded-full text-white shadow-sm transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: CALL_GREEN }}
            >
              {dialing ? <Loader2 className="h-6 w-6 animate-spin" /> : <PhoneCall className="h-6 w-6" />}
            </button>
            <button
              type="button"
              onClick={() => setNumber(number.slice(0, -1))}
              disabled={!number}
              aria-label="Backspace"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </Can>
  );
}
