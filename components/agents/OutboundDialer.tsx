"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Buyer } from "@/lib/supabase";
import type { FromNumber } from "@/lib/telnyx/numbers";
import { isDialableFrom } from "@/lib/telnyx/numbers";
import { BuyerService } from "@/services/buyer-service";
import { useDebounce } from "@/hooks/use-debounce";
import { useAgentTelnyx } from "./AgentTelnyxProvider";
import { Loader2, Phone, PhoneOutgoing, Search, User } from "lucide-react";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((response) => response.json());

const fromGuardMessage = "Selected From must be assigned to the Voice API app or verified in Telnyx.";
const sipTooltipMessage =
  "This number is on your SIP connection. Reassign it to your Voice API app to use it as Caller ID.";

export function OutboundDialer() {
  const { makeCall, status, activeCall } = useAgentTelnyx();
  const [searchValue, setSearchValue] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");

  const { data: numbersData, error: numbersError, isLoading: fromLoading } = useSWR("/api/numbers/list", fetcher);

  const fromItems: FromNumber[] = useMemo(
    () => (Array.isArray(numbersData?.items) ? numbersData.items : []),
    [numbersData?.items],
  );

  const groups = useMemo(() => {
    const assignedToApp = fromItems.filter((item) => item.assignedToApp);
    const onSip = fromItems.filter((item) => item.assignedToSip && !item.assignedToApp && !item.verified);
    const verified = fromItems.filter((item) => item.verified && !item.assignedToApp);
    return { assignedToApp, onSip, verified };
  }, [fromItems]);

  const defaultFromValue = typeof numbersData?.defaultFrom === "string" ? numbersData.defaultFrom : "";
  const hasFromOption = from ? fromItems.some((item) => item.e164 === from) : false;
  const selectedFromItem = fromItems.find((item) => item.e164 === from) || null;
  const selectedDialable = selectedFromItem ? isDialableFrom(selectedFromItem) : false;

  useEffect(() => {
    if (from) {
      return;
    }
    if (defaultFromValue) {
      setFrom(defaultFromValue);
      return;
    }
    if (groups.assignedToApp.length > 0) {
      setFrom(groups.assignedToApp[0].e164);
      return;
    }
    if (groups.verified.length > 0) {
      setFrom(groups.verified[0].e164);
      return;
    }
    if (fromItems.length > 0) {
      setFrom(fromItems[0].e164);
    }
  }, [defaultFromValue, from, fromItems, groups.assignedToApp, groups.verified]);

  const numbersErrorText = numbersError
    ? numbersError instanceof Error
      ? numbersError.message
      : "Unable to load phone numbers"
    : numbersData?.ok === false
    ? typeof numbersData.error === "string"
      ? numbersData.error
      : "Unable to load phone numbers"
    : "";

  const debouncedSearch = useDebounce(searchValue, 300);

  useEffect(() => {
    if (!open) return;

    const searchBuyers = async () => {
      setSearching(true);
      try {
        let results: Buyer[];
        const phonePattern = /^[\d\s()\-\+]+$/;
        if (debouncedSearch && phonePattern.test(debouncedSearch)) {
          const cleanPhone = debouncedSearch.replace(/\D/g, "");
          results = await BuyerService.searchBuyers(cleanPhone);
        } else if (debouncedSearch && debouncedSearch.length > 1) {
          results = await BuyerService.searchBuyers(debouncedSearch);
        } else {
          results = await BuyerService.listBuyers({ limit: 10 });
        }
        setBuyers(results);
      } catch (err) {
        console.error("Failed to search buyers:", err);
        setBuyers([]);
      } finally {
        setSearching(false);
      }
    };

    searchBuyers();
  }, [debouncedSearch, open]);

  const handleSelectBuyer = (buyer: Buyer) => {
    setSelectedBuyer(buyer);
    const phone = buyer.phone || buyer.phone2 || buyer.phone3;
    if (phone) {
      setPhoneNumber(phone);
      setSearchValue(getDisplayName(buyer));
    }
    setOpen(false);
  };

  const handleDial = async () => {
    const numberToDial = phoneNumber.trim();

    if (!numberToDial) {
      setError("Please enter a phone number or select a buyer");
      return;
    }

    let formatted = numberToDial;

    if (!/^\+/.test(formatted) && /^\d{10,}$/.test(formatted)) {
      formatted = `+${formatted}`;
    }

    if (/^\d{10}$/.test(formatted)) {
      formatted = `+1${formatted}`;
    }

    // if (!selectedDialable) {
    //   setError(fromGuardMessage);
    //   return;
    // }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await makeCall(formatted, selectedBuyer?.id, from || undefined);
      setSuccess("Call initiated! Your phone will ring shortly.");
      setError("");
      setSearchValue("");
      setPhoneNumber("");
      setSelectedBuyer(null);
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      setError(err?.message || "Failed to initiate call");
      setSuccess("");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !callButtonDisabled) {
      handleDial();
    }
  };

  const getDisplayName = (buyer: Buyer) => {
    return buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim() || "Unnamed";
  };

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const canMakeCall = status === "idle" && !activeCall;
  // const callButtonDisabled = !canMakeCall || loading || !phoneNumber || !selectedDialable;
  const callButtonDisabled = !canMakeCall || loading || !phoneNumber ;
  const showFromWarning = Boolean(selectedFromItem && !selectedDialable);
  const fromSelectVisible = fromItems.length > 0 || Boolean(from) || Boolean(numbersErrorText);

  const formatFromLabel = (item: FromNumber) => {
    if (item.assignedToApp) {
      return item.e164;
    }
    if (item.verified) {
      return `${item.e164} — Verified Caller ID`;
    }
    if (item.assignedToSip) {
      return `${item.e164} — SIP connection`;
    }
    return item.e164;
  };

  const renderSipItem = (item: FromNumber) => (
    <Tooltip key={item.e164}>
      <TooltipTrigger asChild>
        <SelectItem value={item.e164} disabled>
          {formatFromLabel(item)}
        </SelectItem>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{sipTooltipMessage}</TooltipContent>
    </Tooltip>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PhoneOutgoing className="h-5 w-5" />
          Make a Call
        </CardTitle>
        <CardDescription>Search buyers by name or phone, or dial a number directly</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fromSelectVisible && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span>From Number</span>
                {fromLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <Select value={from} onValueChange={setFrom} disabled={fromLoading || !canMakeCall || loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a number" />
                </SelectTrigger>
                <TooltipProvider>
                  <SelectContent>
                    {groups.assignedToApp.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Assigned to this app (recommended)</SelectLabel>
                        {groups.assignedToApp.map((item) => (
                          <SelectItem key={item.e164} value={item.e164}>
                            {formatFromLabel(item)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {groups.assignedToApp.length > 0 &&
                      (groups.onSip.length > 0 || groups.verified.length > 0) && <SelectSeparator />}
                    {groups.onSip.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>On SIP — reassign to use</SelectLabel>
                        {groups.onSip.map((item) => renderSipItem(item))}
                      </SelectGroup>
                    )}
                    {groups.onSip.length > 0 && groups.verified.length > 0 && <SelectSeparator />}
                    {groups.verified.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Verified caller IDs</SelectLabel>
                        {groups.verified.map((item) => (
                          <SelectItem key={item.e164} value={item.e164}>
                            {formatFromLabel(item)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {!hasFromOption && from && <SelectItem value={from}>{from}</SelectItem>}
                  </SelectContent>
                </TooltipProvider>
              </Select>
              {numbersErrorText && <p className="text-xs text-destructive">{numbersErrorText}</p>}
              {showFromWarning && <p className="text-xs text-destructive">{fromGuardMessage}</p>}
            </div>
          )}
          <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search buyers or enter phone number..."
                    value={searchValue}
                    onChange={(event) => {
                      setSearchValue(event.target.value);
                      setOpen(true);
                      if (!event.target.value) {
                        setPhoneNumber("");
                        setSelectedBuyer(null);
                      }
                    }}
                    onFocus={() => setOpen(true)}
                    disabled={!canMakeCall || loading}
                    className="pl-9"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandList>
                    {searching ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span className="text-sm">Searching...</span>
                      </div>
                    ) : buyers.length > 0 ? (
                      <CommandGroup heading="Buyers">
                        {buyers.map((buyer) => {
                          const phone = buyer.phone || buyer.phone2 || buyer.phone3;
                          return (
                            <CommandItem
                              key={buyer.id}
                              value={buyer.id}
                              onSelect={() => handleSelectBuyer(buyer)}
                              className="cursor-pointer"
                            >
                              <User className="mr-2 h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="font-medium">{getDisplayName(buyer)}</div>
                                {phone && <div className="text-sm text-muted-foreground">{formatPhoneDisplay(phone)}</div>}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    ) : searchValue.length > 1 ? (
                      <CommandEmpty>No buyers found</CommandEmpty>
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">Start typing to search buyers</div>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="flex gap-2">
              <Input
                placeholder="+1234567890"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!canMakeCall || loading}
                className="font-mono"
              />
              {showFromWarning ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button onClick={handleDial} disabled={callButtonDisabled}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">{fromGuardMessage}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button onClick={handleDial} disabled={callButtonDisabled}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {selectedBuyer && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium">Selected Buyer</p>
              <p className="text-sm">{getDisplayName(selectedBuyer)}</p>
              {selectedBuyer.email && <p className="text-xs text-muted-foreground">{selectedBuyer.email}</p>}
            </div>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <AlertDescription className="text-green-800 dark:text-green-200">{success}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!canMakeCall && (
            <p className="text-sm text-muted-foreground">
              {activeCall
                ? "You're already on a call. End the current call to make a new one."
                : status === "connecting"
                ? "Initiating call... Please answer your phone when it rings."
                : "Connecting to phone system..."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
