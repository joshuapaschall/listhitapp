"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import CallRoutingEditor from "@/components/settings/shared/call-routing-editor";
import VoicemailGreetingEditor from "@/components/settings/shared/voicemail-greeting-editor";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Voice = { id: string; label: string; engine: string };
type Market = { id: string; name: string; purpose: "campaign" | "main"; numberCount: number; call_routing_mode: "browser_only"|"browser_first_then_forward"|"forwarding_only"; browser_ring_timeout_seconds: number; call_forwarding_number: string | null; voicemail_greeting_url: string | null; voicemail_greeting_source: "polly" | "recorded" | null };
type NumberItem = { e164: string; label: string | null; enabled: boolean; config_override: boolean; call_routing_mode: "browser_only"|"browser_first_then_forward"|"forwarding_only"; call_forwarding_number: string | null; browser_ring_timeout_seconds: number; voicemail_greeting_url: string | null; voicemail_greeting_source: "polly" | "recorded" | null };

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [market, setMarket] = useState<Market | null>(null);
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [activeTab, setActiveTab] = useState("routing");
  const [renameValue, setRenameValue] = useState("");
  const [renameMode, setRenameMode] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveNumber, setMoveNumber] = useState("");
  const [moveTarget, setMoveTarget] = useState("");

  const overrideCount = useMemo(() => numbers.filter((number) => number.config_override).length, [numbers]);

  async function loadAll() {
    const [marketRes, numbersRes, voicesRes, marketsRes] = await Promise.all([
      fetch(`/api/markets/${id}`).then((response) => response.json()),
      fetch(`/api/markets/${id}/numbers`).then((response) => response.json()),
      fetch("/api/markets/greeting/generate").then((response) => response.json()),
      fetch("/api/markets").then((response) => response.json()),
    ]);

    setMarket(marketRes.market ?? null);
    setRenameValue(marketRes.market?.name ?? "");
    setNumbers(numbersRes.numbers ?? []);
    setVoices(voicesRes.voices ?? []);
    setAllMarkets(marketsRes.markets ?? []);
  }

  useEffect(() => {
    void loadAll();
  }, [id]);

  if (!market) {
    return <div className="p-8">Loading...</div>;
  }

  const otherMarkets = allMarkets.filter((entry) => entry.id !== market.id);

  return (
    <div className="space-y-6 p-8">
      <Link href="/settings/markets" className="text-sm text-muted-foreground hover:text-emerald-700">← Back to Markets</Link>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          {renameMode ? (
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={async (event) => {
                if (event.key === "Escape") setRenameMode(false);
                if (event.key === "Enter") {
                  const response = await fetch(`/api/markets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: renameValue }) });
                  const data = await response.json();
                  if (data?.ok) {
                    setMarket(data.market);
                    setRenameMode(false);
                  }
                }
              }}
              className="max-w-md"
            />
          ) : (
            <h1 className="text-3xl font-semibold tracking-tight">{market.name}</h1>
          )}
          <p className="text-sm text-muted-foreground">{market.numberCount} numbers in this market · {market.purpose === "campaign" ? "Campaign" : "Main"} market</p>
          <Button variant="ghost" size="sm" onClick={() => setRenameMode(true)}><Pencil className="mr-2 h-4 w-4" />Rename</Button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="routing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700">Call routing & voicemail</TabsTrigger>
          <TabsTrigger value="numbers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700">Phone numbers</TabsTrigger>
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="routing" className="mt-6 space-y-4">
          {market.purpose === "campaign" ? (
            <>
              <Card>
                <CardHeader><CardTitle>Market routing & voicemail</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <CallRoutingEditor scopeId={market.id} patchEndpoint={`/api/markets/${id}`} callRoutingMode={market.call_routing_mode} browserRingTimeoutSeconds={market.browser_ring_timeout_seconds} callForwardingNumber={market.call_forwarding_number} onSaved={(next) => setMarket((prev) => prev ? ({ ...prev, ...next }) : prev)} />
                  <VoicemailGreetingEditor scopeId={market.id} scopeType="market" patchEndpoint={`/api/markets/${id}`} generateEndpoint="/api/markets/greeting/generate" currentUrl={market.voicemail_greeting_url} currentSource={market.voicemail_greeting_source} voices={voices} onSaved={(url, source) => setMarket((prev) => prev ? ({ ...prev, voicemail_greeting_url: url, voicemail_greeting_source: source }) : prev)} onRemoved={() => setMarket((prev) => prev ? ({ ...prev, voicemail_greeting_url: null, voicemail_greeting_source: null }) : prev)} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <Accordion type="single" collapsible>
                    <AccordionItem value="overrides">
                      <AccordionTrigger>Override per number ({overrideCount})</AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        {numbers.map((number) => (
                          <Card key={number.e164} id={`num-${number.e164}`}>
                            <CardContent className="space-y-4 p-4">
                              <div className="flex items-center justify-between">
                                <NumberIdentity label={number.label} e164={number.e164} />
                                <Switch checked={number.config_override} onCheckedChange={async (checked) => {
                                  const response = await fetch(`/api/markets/numbers/${encodeURIComponent(number.e164)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config_override: checked }) });
                                  const data = await response.json();
                                  if (data?.ok) setNumbers((prev) => prev.map((item) => item.e164 === number.e164 ? { ...item, config_override: checked } : item));
                                }} />
                              </div>
                              {number.config_override ? (
                                <div className="space-y-6 border-t pt-4">
                                  <CallRoutingEditor scopeId={number.e164} patchEndpoint={`/api/markets/numbers/${encodeURIComponent(number.e164)}`} callRoutingMode={number.call_routing_mode} browserRingTimeoutSeconds={number.browser_ring_timeout_seconds} callForwardingNumber={number.call_forwarding_number} onSaved={(next) => setNumbers((prev) => prev.map((item) => item.e164 === number.e164 ? ({ ...item, ...next }) : item))} />
                                  <VoicemailGreetingEditor scopeId={number.e164} scopeType="number" patchEndpoint={`/api/markets/numbers/${encodeURIComponent(number.e164)}`} generateEndpoint="/api/markets/greeting/generate" currentUrl={number.voicemail_greeting_url} currentSource={number.voicemail_greeting_source} voices={voices} onSaved={(url, source) => setNumbers((prev) => prev.map((item) => item.e164 === number.e164 ? ({ ...item, voicemail_greeting_url: url, voicemail_greeting_source: source }) : item))} onRemoved={() => setNumbers((prev) => prev.map((item) => item.e164 === number.e164 ? ({ ...item, voicemail_greeting_url: null, voicemail_greeting_source: null }) : item))} />
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle>Numbers in this market</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {numbers.map((number) => (
                    <Accordion type="single" collapsible key={number.e164}>
                      <AccordionItem value={number.e164} id={`num-${number.e164}`}>
                        <AccordionTrigger>
                          <div className="flex items-center gap-2"><span>{number.label || number.e164}</span><Badge className="bg-emerald-50 text-emerald-700">Per-number config</Badge></div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6">
                          <button className="text-sm text-muted-foreground underline" onClick={async () => {
                            await fetch(`/api/markets/numbers/${encodeURIComponent(number.e164)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config_override: false }) });
                            setNumbers((prev) => prev.map((item) => item.e164 === number.e164 ? { ...item, config_override: false } : item));
                          }}>Use market default instead</button>
                          <CallRoutingEditor scopeId={number.e164} patchEndpoint={`/api/markets/numbers/${encodeURIComponent(number.e164)}`} callRoutingMode={number.call_routing_mode} browserRingTimeoutSeconds={number.browser_ring_timeout_seconds} callForwardingNumber={number.call_forwarding_number} onSaved={(next) => setNumbers((prev) => prev.map((item) => item.e164 === number.e164 ? ({ ...item, ...next }) : item))} />
                          <VoicemailGreetingEditor scopeId={number.e164} scopeType="number" patchEndpoint={`/api/markets/numbers/${encodeURIComponent(number.e164)}`} generateEndpoint="/api/markets/greeting/generate" currentUrl={number.voicemail_greeting_url} currentSource={number.voicemail_greeting_source} voices={voices} onSaved={(url, source) => setNumbers((prev) => prev.map((item) => item.e164 === number.e164 ? ({ ...item, voicemail_greeting_url: url, voicemail_greeting_source: source }) : item))} onRemoved={() => setNumbers((prev) => prev.map((item) => item.e164 === number.e164 ? ({ ...item, voicemail_greeting_url: null, voicemail_greeting_source: null }) : item))} />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Set market default (optional)</CardTitle></CardHeader>
                <CardContent className="space-y-6"><p className="text-sm text-muted-foreground">Numbers with per-number config above use their own settings. This is the fallback if you turn a number&apos;s per-number config off.</p><CallRoutingEditor scopeId={market.id} patchEndpoint={`/api/markets/${id}`} callRoutingMode={market.call_routing_mode} browserRingTimeoutSeconds={market.browser_ring_timeout_seconds} callForwardingNumber={market.call_forwarding_number} onSaved={(next) => setMarket((prev) => prev ? ({ ...prev, ...next }) : prev)} /><VoicemailGreetingEditor scopeId={market.id} scopeType="market" patchEndpoint={`/api/markets/${id}`} generateEndpoint="/api/markets/greeting/generate" currentUrl={market.voicemail_greeting_url} currentSource={market.voicemail_greeting_source} voices={voices} onSaved={(url, source) => setMarket((prev) => prev ? ({ ...prev, voicemail_greeting_url: url, voicemail_greeting_source: source }) : prev)} onRemoved={() => setMarket((prev) => prev ? ({ ...prev, voicemail_greeting_url: null, voicemail_greeting_source: null }) : prev)} /></CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="numbers" className="mt-6 space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-lg font-medium">Numbers in {market.name}</h2><Button onClick={() => setMoveOpen(true)}>Move number</Button></div>
          <Card>
            <CardContent className="p-0">
              {numbers.map((number) => (
                <div key={number.e164} className="flex items-center justify-between border-b px-4 py-3">
                  <LabeledValue label="Phone number"><NumberIdentity label={number.label || "No label"} e164={number.e164} /></LabeledValue>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={number.config_override ? "border-slate-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{number.config_override ? "Per-number config" : "Inherits market config"}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setMoveNumber(number.e164); setMoveOpen(true); }}>Move to market…</DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          const response = await fetch(`/api/markets/numbers/${encodeURIComponent(number.e164)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config_override: !number.config_override }) });
                          const data = await response.json();
                          if (data?.ok) setNumbers((prev) => prev.map((item) => item.e164 === number.e164 ? { ...item, config_override: !number.config_override } : item));
                        }}>Toggle per-number config</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setActiveTab("routing"); document.getElementById(`num-${number.e164}`)?.scrollIntoView({ behavior: "smooth" }); }}>Open routing tab</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <Card className="bg-emerald-50 border-emerald-200"><CardContent className="p-6"><p className="text-sm text-emerald-700">Numbers in market</p><p className="text-2xl font-semibold text-emerald-900">{market.numberCount}</p></CardContent></Card>
          <Card>
            <CardHeader><CardTitle>Current configuration</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Stat label="Routing mode" value={routingModeLabel(market.call_routing_mode)} />
              <Stat label="Ring timeout" value={`${market.browser_ring_timeout_seconds}s`} />
              <Stat label="Voicemail greeting" value={market.voicemail_greeting_source === "polly" ? "AI Voice (Danielle)" : market.voicemail_greeting_source === "recorded" ? "Recorded" : "Default greeting"} />
              <Stat label="Forwarding number" value={market.call_forwarding_number ?? "Not set"} />
              <Stat label="Override count" value={String(overrideCount)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Move number</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={moveNumber} onValueChange={setMoveNumber}><SelectTrigger><SelectValue placeholder="Select number" /></SelectTrigger><SelectContent>{numbers.map((number) => <SelectItem key={number.e164} value={number.e164}>{number.label || number.e164}</SelectItem>)}</SelectContent></Select>
            <Select value={moveTarget} onValueChange={setMoveTarget}><SelectTrigger><SelectValue placeholder="Select target market" /></SelectTrigger><SelectContent>{otherMarkets.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}</SelectContent></Select>
            <Button className="w-full" onClick={async () => {
              if (!moveNumber || !moveTarget) return;
              await fetch(`/api/markets/${market.id}/numbers`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unassign: [moveNumber] }) });
              await fetch(`/api/markets/${moveTarget}/numbers`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assign: [moveNumber] }) });
              setMoveOpen(false);
              setMoveNumber("");
              setMoveTarget("");
              await loadAll();
            }}>Move number</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this market?</AlertDialogTitle><AlertDialogDescription>{deleteError || "This action cannot be undone."}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const response = await fetch(`/api/markets/${id}`, { method: "DELETE" });
              const data = await response.json();
              if (response.status === 409) {
                setDeleteError(`Move numbers out first (${data.numberCount}).`);
                return;
              }
              if (data?.ok) router.push("/settings/markets");
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function LabeledValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function NumberIdentity({ label, e164 }: { label: string | null; e164: string }) {
  return (
    <div>
      <p className="font-medium">{label || e164}</p>
      <p className="text-sm text-muted-foreground">{formatE164(e164)}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div>;
}

function formatE164(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return input;
}

function routingModeLabel(mode: string) {
  if (mode === "browser_only") {
    return "Browser only";
  }
  if (mode === "browser_first_then_forward") {
    return "Browser then forward";
  }
  if (mode === "forwarding_only") {
    return "Forwarding only";
  }
  return mode;
}
