"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { BuyerService } from "@/services/buyer-service";
import { formatPhoneDisplay, formatPhoneE164 } from "@/lib/dedup-utils";
import { useCall } from "@/components/voice/CallProvider";
import type { Buyer } from "@/lib/supabase";
import { Loader2, PhoneCall, Search } from "lucide-react";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((response) => response.json());

export function Dialer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { makeCall, status, activeCall, setCurrentContact } = useCall();
  const [search, setSearch] = useState("");
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [searching, setSearching] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [number, setNumber] = useState("");
  const [from, setFrom] = useState("");
  const [dialing, setDialing] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: numbersData } = useSWR(open ? "/api/numbers/list" : null, fetcher);
  const fromItems = useMemo(() => (Array.isArray(numbersData?.items) ? numbersData.items : []), [numbersData?.items]);

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
      await makeCall(to, selectedBuyer?.id, from || undefined);
      onOpenChange(false);
      setNumber("");
      setSearch("");
      setSelectedBuyer(null);
    } finally {
      setDialing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New call</DialogTitle>
          <DialogDescription>Search a buyer or dial manually.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Buyer</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
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
                            <div className="flex flex-col">
                              <span>{name}</span>
                              <span className="text-xs text-muted-foreground">{formatPhoneDisplay(phone) || "No phone"}</span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dial-number">To</Label>
            <Input id="dial-number" value={number} onChange={(e) => setNumber(e.target.value)} className="font-mono" placeholder="+1 (555) 555-5555" />
          </div>
          <div className="space-y-2">
            <Label>From number</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger><SelectValue placeholder="Select from number" /></SelectTrigger>
              <SelectContent>
                {fromItems.map((item: { e164: string }) => <SelectItem key={item.e164} value={item.e164}>{item.e164}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["1","2","3","4","5","6","7","8","9","*","0","#"].map((d) => (
              <Button key={d} variant="outline" type="button" className="h-11 font-mono" onClick={() => pressKey(d)}>{d}</Button>
            ))}
          </div>
          <Button type="button" className="w-full bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-hover))] text-white" onClick={call} disabled={dialing || busy || !number.trim()}>
            {dialing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}Call
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
