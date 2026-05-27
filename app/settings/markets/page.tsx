"use client";

import Link from "next/link";
import { ChevronRight, Globe, MapPin, Plus, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";

type Market = { id: string; name: string; purpose: "campaign" | "main"; numberCount: number; call_routing_mode: string | null; voicemail_greeting_source: "polly" | "recorded" | null };

export default function MarketsPage() {
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<"campaign" | "main">("campaign");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadMarkets() {
    setLoading(true);
    const response = await fetch("/api/markets");
    const data = await response.json();
    setMarkets(data.markets ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadMarkets();
  }, []);

  const sortedMarkets = useMemo(() => [...markets].sort((a, b) => a.name.localeCompare(b.name)), [markets]);

  async function createMarket() {
    setCreating(true);
    setCreateError("");
    const response = await fetch("/api/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, purpose }),
    });
    const data = await response.json();
    setCreating(false);

    if (!response.ok || !data?.ok) {
      setCreateError(data?.error ?? "Failed to create market.");
      return;
    }

    setDialogOpen(false);
    setName("");
    router.push(`/settings/markets/${data.market.id}`);
  }

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Markets</h1>
          <p className="text-sm text-muted-foreground">Group your numbers and configure routing & voicemail once per market.</p>
        </div>
        <MarketCreateDialog
          dialogOpen={dialogOpen}
          setDialogOpen={setDialogOpen}
          name={name}
          setName={setName}
          purpose={purpose}
          setPurpose={setPurpose}
          createError={createError}
          creating={creating}
          onCreate={createMarket}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx}><CardContent className="space-y-4 p-6"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-8 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : sortedMarkets.length === 0 ? (
        <Card><CardContent className="space-y-4 p-8 text-center"><p className="text-lg font-medium">No markets yet</p><p className="text-sm text-muted-foreground">Create your first market to organize numbers and apply shared routing.</p><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDialogOpen(true)}>Create first market</Button></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sortedMarkets.map((market) => (
            <Link key={market.id} href={`/settings/markets/${market.id}`} className="group">
              <Card className="border-emerald-100 transition hover:border-emerald-300 hover:shadow-sm">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]">
                        {market.purpose === "campaign" ? <MapPin size={18} /> : <Star size={18} />}
                      </div>
                      <div>
                        <p className="text-base font-medium">{market.name}</p>
                        <p className="text-sm text-muted-foreground">{market.numberCount} numbers</p>
                      </div>
                    </div>
                    <ChevronRight className="text-muted-foreground transition group-hover:text-emerald-700" size={18} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{market.call_routing_mode ?? "browser_only"}</Badge>
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{market.voicemail_greeting_source === "polly" ? "AI Voice" : market.voicemail_greeting_source === "recorded" ? "Recorded" : "Default greeting"}</Badge>
                    <Badge className={market.purpose === "campaign" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>{market.purpose === "campaign" ? "Campaign" : "Main"}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          <button className="rounded-xl border border-dashed border-emerald-200 bg-white p-6 text-left transition hover:border-emerald-400" onClick={() => setDialogOpen(true)}>
            <div className="flex items-center gap-2 text-emerald-700"><Plus size={16} /> New market</div>
            <p className="mt-1 text-sm text-muted-foreground">Create another market for a new line of business.</p>
          </button>
        </div>
      )}
    </div>
  );
}

function MarketCreateDialog(props: {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  name: string;
  setName: (value: string) => void;
  purpose: "campaign" | "main";
  setPurpose: (value: "campaign" | "main") => void;
  createError: string;
  creating: boolean;
  onCreate: () => void;
}) {
  return (
    <Dialog open={props.dialogOpen} onOpenChange={props.setDialogOpen}>
      <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700">New market</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create market</DialogTitle>
          <DialogDescription>Set up a market to manage routing and greeting at the group level.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input value={props.name} onChange={(event) => props.setName(event.target.value)} placeholder="Atlanta" />
          <RadioGroup value={props.purpose} onValueChange={(value) => props.setPurpose(value as "campaign" | "main")} className="space-y-2">
            <label className="flex cursor-pointer gap-3 rounded-lg border p-3"><RadioGroupItem value="campaign" /><div><p className="font-medium">Campaign</p><p className="text-sm text-muted-foreground">Text blasts and outreach numbers</p></div></label>
            <label className="flex cursor-pointer gap-3 rounded-lg border p-3"><RadioGroupItem value="main" /><div><p className="font-medium">Main</p><p className="text-sm text-muted-foreground">Company lines like Main, Sales, Support</p></div></label>
          </RadioGroup>
          {props.createError ? <p className="text-sm text-rose-700">{props.createError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.setDialogOpen(false)}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={props.onCreate} disabled={props.creating}>{props.creating ? "Creating..." : "Create market"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
