"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Check,
  DollarSign,
  Globe,
  Home,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  MapPin,
  Minus,
  Percent,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Tag as TagIcon,
  Upload,
  Users,
} from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import AddressAutocomplete from "@/components/properties/address-autocomplete";
import MapPreview from "@/components/properties/map-preview";
import TagSelector from "@/components/buyers/tag-selector";
import SortableImageGrid, { type ImageItem } from "@/components/properties/sortable-image-grid";
import { PropertyService } from "@/services/property-service";
import { BuyerService } from "@/services/buyer-service";
import type { Buyer, Property } from "@/lib/supabase";
import { PROPERTY_TYPES } from "@/lib/constant";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STEPS = ["Property details", "Disposition & pricing", "Photos & links"];
const STATUSES = ["available", "under_contract", "sold"];
const CONDITIONS = ["Turnkey", "Light Rehab", "Full Rehab"];
const STRATEGIES = ["Wholesale", "Fix & Flip", "Buy & Hold", "Owner Finance", "Subject-To", "Land Contract", "Novation"];
const BUYER_FITS = ["Cash Buyer", "Fix & Flip", "Buy & Hold / Landlord", "Owner-Finance Buyer", "Creative / Sub-To", "Turnkey"];
const OCCUPANCIES = ["Vacant", "Tenant", "Owner-Occupied"];
const PRIORITIES = ["High", "Medium", "Low"];
const FINANCE_SUBTYPES = [
  { value: "owner_finance", label: "Owner finance" },
  { value: "subject_to", label: "Subject-to" },
  { value: "land_contract", label: "Land contract" },
];

// Parse a money/number string to a number (or null when empty/invalid).
const toNum = (value: string) => {
  if (!value || !value.trim()) return null;
  const n = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

function SectionLabel({ icon: Icon, children }: { icon: typeof Home; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/10 text-brand">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </div>
  );
}

function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export default function AddPropertyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [similarProperty, setSimilarProperty] = useState<Property | null>(null);
  const [coords, setCoords] = useState<{
    lat: number | null;
    lng: number | null;
  }>({ lat: null, lng: null });
  const [matchedBuyers, setMatchedBuyers] = useState<Buyer[]>([]);
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [form, setForm] = useState({
    address: "",
    city: "",
    state: "",
    zip: "",
    property_type: "",
    bedrooms: "",
    bathrooms: "",
    sqft: "",
    price: "",
    buy_price: "",
    deal_type: "cash",
    finance_subtype: "",
    down_payment: "",
    monthly_payment: "",
    interest_rate: "",
    term_months: "",
    balloon_months: "",
    existing_loan_balance: "",
    lockbox_code: "",
    condition: "",
    status: "available",
    disposition_strategy: "",
    buyer_fit: "",
    occupancy: "",
    priority: "",
    tags: [] as string[],
    notes: "",
    video_link: "",
    website_url: "",
  });

  const handleChange = <K extends keyof typeof form>(
    field: K,
    value: (typeof form)[K],
  ) => setForm((prev) => ({ ...prev, [field]: value }));
  const debouncedAddress = useDebounce(
    `${form.address}|${form.city}|${form.zip}`,
    400,
  );
  const numericPrice = form.price
    ? Number(form.price.replace(/[^\d]/g, ""))
    : undefined;
  const numericBuyPrice = form.buy_price
    ? Number(form.buy_price.replace(/[^\d]/g, ""))
    : undefined;
  const isCreative = form.deal_type === "creative";
  const isVacant = form.occupancy.toLowerCase() === "vacant";
  const photoPreviews = useMemo(
    () =>
      photos.map((photo) => ({
        name: photo.name,
        url: URL.createObjectURL(photo),
      })),
    [photos],
  );
  const allImageItems: ImageItem[] = useMemo(
    () =>
      photoPreviews.map((p, i) => ({
        id: `new-${i}`,
        url: p.url,
        isNew: true,
        isFeatured: false,
        label: p.name,
      })),
    [photoPreviews],
  );

  useEffect(
    () => () => photoPreviews.forEach((p) => URL.revokeObjectURL(p.url)),
    [photoPreviews],
  );
  useEffect(() => {
    if (form.address.trim().length < 5) return setSimilarProperty(null);
    PropertyService.findByAddress(
      form.address,
      form.city || null,
      form.zip || null,
    )
      .then(setSimilarProperty)
      .catch(() => setSimilarProperty(null));
  }, [debouncedAddress, form.address, form.city, form.zip]);

  // Matched buyers: fire on ANY usable signal (not only when all are present).
  useEffect(() => {
    const creative = form.deal_type === "creative";
    const hasSignal =
      form.city || form.state || form.property_type || numericPrice || form.buyer_fit || creative;
    if (!hasSignal) return setMatchedBuyers([]);

    // Best-effort fit hint: property tags + the chosen buyer_fit string.
    const tagHints = [...form.tags, form.buyer_fit].filter(Boolean) as string[];

    BuyerService.getBuyersByCriteria({
      city: form.city || undefined,
      state: form.state || undefined,
      propertyType: form.property_type || undefined,
      dealType: creative ? "creative" : "cash",
      tags: tagHints.length ? tagHints : undefined,
      ...(creative ? {} : { minPrice: numericPrice, maxPrice: numericPrice }),
    })
      .then(setMatchedBuyers)
      .catch(() => setMatchedBuyers([]));
  }, [form.city, form.state, form.property_type, numericPrice, form.buyer_fit, form.deal_type, form.tags]);

  const toggleBuyer = (id: string) =>
    setSelectedBuyers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const adjustNumberField = (field: "bedrooms" | "bathrooms", delta: number) =>
    handleChange(
      field,
      String(Math.max(0, Number(form[field] || "0") + delta)),
    );
  const formatPrice = (field: "price" | "buy_price") => {
    const value = field === "price" ? numericPrice : numericBuyPrice;
    handleChange(field, value ? value.toLocaleString() : "");
  };
  const handleDropFiles = (files: FileList | null) =>
    files && setPhotos((prev) => [...prev, ...Array.from(files)]);

  const handleSubmit = async () => {
    if (!form.address.trim()) {
      toast.error("Address is required");
      return;
    }
    setLoading(true);
    try {
      const creative = form.deal_type === "creative";
      const property = await PropertyService.addProperty({
        address: form.address,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        price: numericPrice ?? null,
        buy_price: numericBuyPrice ?? null,
        deal_type: form.deal_type,
        finance_subtype: creative ? form.finance_subtype || null : null,
        down_payment: creative ? toNum(form.down_payment) : null,
        monthly_payment: creative ? toNum(form.monthly_payment) : null,
        interest_rate: creative ? toNum(form.interest_rate) : null,
        term_months: creative ? toNum(form.term_months) : null,
        balloon_months: creative ? toNum(form.balloon_months) : null,
        existing_loan_balance:
          creative && form.finance_subtype === "subject_to" ? toNum(form.existing_loan_balance) : null,
        lockbox_code: isVacant ? form.lockbox_code || null : null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        sqft: form.sqft ? Number(form.sqft) : null,
        property_type: form.property_type || null,
        condition: form.condition || null,
        status: form.status,
        disposition_strategy: form.disposition_strategy || null,
        buyer_fit: form.buyer_fit || null,
        occupancy: form.occupancy || null,
        priority: form.priority || null,
        description: form.notes || null,
        tags: form.tags.length > 0 ? form.tags : null,
        video_link: form.video_link || null,
        website_url: form.website_url || null,
        latitude: coords.lat,
        longitude: coords.lng,
      });
      if (photos.length > 0) {
        try {
          const { errors } = await PropertyService.uploadImages(property.id, photos);
          if (errors.length > 0) {
            toast.warning(`Some photos failed to upload: ${errors.join(", ")}`);
          }
        } catch (uploadErr) {
          console.error("Photo upload failed:", uploadErr);
          toast.warning("Property saved but photo upload failed. You can add photos by editing the property.");
        }
      }
      for (const id of selectedBuyers)
        await PropertyService.addBuyerToProperty(property.id, id).catch(
          console.error,
        );
      toast.success("Property added");
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      router.push(`/properties/${property.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add property");
    } finally {
      setLoading(false);
    }
  };

  const moneyField = (
    field: keyof typeof form,
    label: string,
    placeholder: string,
    opts?: { suffix?: string },
  ) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="relative">
        {opts?.suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{opts.suffix}</span>
        ) : (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        )}
        <Input
          className={opts?.suffix ? "h-9 pr-10" : "h-9 pl-7"}
          placeholder={placeholder}
          value={form[field] as string}
          onChange={(e) => handleChange(field, e.target.value as never)}
        />
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add property</h1>
          <p className="mt-1 text-sm text-muted-foreground">Capture the deal, set pricing, and surface matched buyers.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 md:p-6">
          {/* Stepper */}
          <div className="mb-6 flex items-center gap-2">
            {STEPS.map((s, i) => {
              const done = i < currentStep;
              const active = i === currentStep;
              return (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <button type="button" onClick={() => setCurrentStep(i)} className="flex items-center gap-2.5 text-left">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                        done && "bg-emerald-500 text-white",
                        active && "bg-brand text-white",
                        !done && !active && "bg-muted text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>{s}</span>
                  </button>
                  {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
                </div>
              );
            })}
          </div>

          {currentStep === 0 && (
            <Card className="border-border">
              <CardContent className="grid gap-6 p-5 md:grid-cols-2">
                <div className="space-y-5">
                  <SectionLabel icon={Home}>Property details</SectionLabel>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Address <span className="text-brand">*</span>
                    </Label>
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                        <Search className="h-4 w-4" />
                        <span className="text-xs">Search property address</span>
                      </div>
                      <AddressAutocomplete
                        value={{
                          address: form.address,
                          city: form.city,
                          state: form.state,
                          zip: form.zip,
                        }}
                        onSelect={(val) => {
                          handleChange("address", val.address);
                          handleChange("city", val.city);
                          handleChange("state", val.state);
                          handleChange("zip", val.zip);
                          setCoords({ lat: val.latitude, lng: val.longitude });
                        }}
                      />
                    </div>
                    {similarProperty && (
                      <Alert variant="destructive">
                        <AlertTitle>Possible duplicate</AlertTitle>
                        <AlertDescription>
                          A similar property exists at{" "}
                          <Link
                            href={`/properties/${similarProperty.id}`}
                            className="underline"
                          >
                            {similarProperty.address}
                          </Link>
                          .
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">City</Label>
                      <Input
                        className="h-9"
                        value={form.city}
                        placeholder="Austin"
                        onChange={(e) => handleChange("city", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">State</Label>
                      <Input
                        className="h-9"
                        value={form.state}
                        placeholder="TX"
                        onChange={(e) => handleChange("state", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Zip</Label>
                      <Input
                        className="h-9"
                        value={form.zip}
                        placeholder="78701"
                        onChange={(e) => handleChange("zip", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Property type</Label>
                    <Select
                      value={form.property_type}
                      onValueChange={(v) => handleChange("property_type", v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select property type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPERTY_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Bedrooms</Label>
                      <div className="flex">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9"
                          onClick={() => adjustNumberField("bedrooms", -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          value={form.bedrooms}
                          className="h-9 rounded-none text-center"
                          onChange={(e) =>
                            handleChange("bedrooms", e.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9"
                          onClick={() => adjustNumberField("bedrooms", 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Bathrooms</Label>
                      <div className="flex">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9"
                          onClick={() => adjustNumberField("bathrooms", -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          value={form.bathrooms}
                          className="h-9 rounded-none text-center"
                          onChange={(e) =>
                            handleChange("bathrooms", e.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9"
                          onClick={() => adjustNumberField("bathrooms", 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Square feet</Label>
                      <Input
                        className="h-9"
                        value={form.sqft}
                        placeholder="1,850"
                        onChange={(e) => handleChange("sqft", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <SectionLabel icon={MapPin}>Map preview</SectionLabel>
                  {MAPBOX_TOKEN ? (
                    <MapPreview
                      latitude={coords.lat}
                      longitude={coords.lng}
                      className="h-[300px] overflow-hidden rounded-xl shadow-sm"
                    />
                  ) : (
                    <div className="flex h-[300px] items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
                      <MapPin className="mr-2 h-5 w-5" />
                      Enter an address to see the map
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 1 && (
            <Card className="border-border">
              <CardContent className="grid gap-6 p-5 md:grid-cols-2">
                <div className="space-y-5">
                  {/* Deal type */}
                  <div className="space-y-3">
                    <SectionLabel icon={Banknote}>Deal type</SectionLabel>
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                      <SegButton active={!isCreative} onClick={() => handleChange("deal_type", "cash")}>
                        Cash deal
                      </SegButton>
                      <SegButton active={isCreative} onClick={() => handleChange("deal_type", "creative")}>
                        Creative finance
                      </SegButton>
                    </div>

                    {!isCreative ? (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-sm">Asking price</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              className="h-10 pl-9 text-lg"
                              placeholder="125,000"
                              value={form.price}
                              onBlur={() => formatPrice("price")}
                              onChange={(e) => handleChange("price", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm">Buy price</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              className="h-10 pl-9 text-lg"
                              placeholder="100,000"
                              value={form.buy_price}
                              onBlur={() => formatPrice("buy_price")}
                              onChange={(e) => handleChange("buy_price", e.target.value)}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Your cost basis — what you&apos;re getting it under contract for.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-sm">Creative type</Label>
                          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                            {FINANCE_SUBTYPES.map((st) => (
                              <SegButton
                                key={st.value}
                                active={form.finance_subtype === st.value}
                                onClick={() => handleChange("finance_subtype", st.value)}
                              >
                                {st.label}
                              </SegButton>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm">List price</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              className="h-10 pl-9 text-lg"
                              placeholder="125,000"
                              value={form.price}
                              onBlur={() => formatPrice("price")}
                              onChange={(e) => handleChange("price", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {moneyField("down_payment", "Down payment", "10,000")}
                          {moneyField("monthly_payment", "Monthly payment", "1,200")}
                          {moneyField("interest_rate", "Interest rate", "6.5", { suffix: "%" })}
                          {moneyField("term_months", "Term", "360", { suffix: "mo" })}
                          {moneyField("balloon_months", "Balloon", "60", { suffix: "mo" })}
                          {form.finance_subtype === "subject_to"
                            ? moneyField("existing_loan_balance", "Existing loan balance", "180,000")
                            : null}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Disposition */}
                  <div className="space-y-3">
                    <SectionLabel icon={SlidersHorizontal}>Disposition</SectionLabel>
                    <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-4">
                      <div className="space-y-1.5"><Label className="text-sm">Condition</Label><Select value={form.condition} onValueChange={(v) => handleChange("condition", v)}><SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-1.5"><Label className="text-sm">Status</Label><Select value={form.status} onValueChange={(v) => handleChange("status", v)}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-1.5"><Label className="text-sm">Strategy</Label><Select value={form.disposition_strategy} onValueChange={(v) => handleChange("disposition_strategy", v)}><SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-1.5"><Label className="text-sm">Buyer fit</Label><Select value={form.buyer_fit} onValueChange={(v) => handleChange("buyer_fit", v)}><SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{BUYER_FITS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-1.5"><Label className="text-sm">Occupancy</Label><Select value={form.occupancy} onValueChange={(v) => handleChange("occupancy", v)}><SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{OCCUPANCIES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-1.5"><Label className="text-sm">Priority</Label><Select value={form.priority} onValueChange={(v) => handleChange("priority", v)}><SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                      {isVacant ? (
                        <div className="col-span-2 space-y-1.5">
                          <Label className="text-sm">Lockbox code</Label>
                          <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              className="h-9 pl-9"
                              placeholder="e.g. 1234"
                              value={form.lockbox_code}
                              onChange={(e) => handleChange("lockbox_code", e.target.value)}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <SectionLabel icon={TagIcon}>Tags &amp; notes</SectionLabel>
                    <div className="rounded-lg border border-border bg-muted/10 p-3"><TagSelector value={form.tags} onChange={(v) => handleChange("tags", v)} allowCreate={true} /></div>
                    <Textarea rows={3} placeholder="Add disposition notes, access details, or selling angle..." value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} />
                    <p className="text-right text-xs text-muted-foreground">{form.notes.length} characters</p>
                  </div>
                  <div className="space-y-2">
                    <SectionLabel icon={Users}>Matched buyers ({matchedBuyers.length})</SectionLabel>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                      {matchedBuyers.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">No matching buyers yet — add a location, type, price, or buyer fit to see matches.</p>
                      ) : (
                        matchedBuyers.map((b) => (
                          <label key={b.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-muted/10 px-3 py-2 text-sm hover:bg-muted/30">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                                {`${b.fname?.[0] || ""}${b.lname?.[0] || ""}`.toUpperCase() || "?"}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed buyer"}</p>
                                <p className="truncate text-xs text-muted-foreground">{b.mailing_city || "Any city"}{b.mailing_state ? `, ${b.mailing_state}` : ""}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">{form.buyer_fit || "Match"}</span>
                              <Checkbox checked={selectedBuyers.includes(b.id)} onCheckedChange={() => toggleBuyer(b.id)} />
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="border-border">
              <CardContent className="grid gap-6 p-5 md:grid-cols-[1fr_1fr]">
                <div className="space-y-3 md:col-span-1">
                  <SectionLabel icon={ImageIcon}>Property photos</SectionLabel>
                  <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => handleDropFiles(e.target.files)} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleDropFiles(e.dataTransfer.files); }} className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 text-muted-foreground transition-colors hover:border-brand/50 hover:bg-muted/30">
                    <Upload className="mb-2 h-5 w-5" /><span className="text-sm">Drag photos here or click to browse</span><span className="mt-1 text-xs text-muted-foreground/60">JPEG, PNG, WebP — up to 10MB each</span>
                  </button>
                  <SortableImageGrid items={allImageItems} onReorder={(reordered) => { const newOrder = reordered.map((item) => { const idx = parseInt(item.id.replace("new-", ""), 10); return photos[idx]; }).filter((image): image is File => Boolean(image)); setPhotos(newOrder); }} onDelete={(itemId) => { const idx = parseInt(itemId.replace("new-", ""), 10); setPhotos((prev) => prev.filter((_, i) => i !== idx)); }} onSetFeatured={() => {}} />
                </div>
                <div className="space-y-4 md:col-span-1">
                  <SectionLabel icon={Globe}>Links</SectionLabel>
                  <div className="space-y-1.5"><Label className="text-sm">Video link</Label><div className="relative"><Play className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-9 pl-9" placeholder="https://youtube.com/..." value={form.video_link} onChange={(e) => handleChange("video_link", e.target.value)} /></div></div>
                  <div className="space-y-1.5"><Label className="text-sm">Website URL</Label><div className="relative"><Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-9 pl-9" placeholder="https://yourpropertysite.com" value={form.website_url} onChange={(e) => handleChange("website_url", e.target.value)} /></div></div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => router.push("/properties")}>
                Cancel
              </Button>
              {currentStep > 0 && (
                <Button variant="ghost" onClick={() => setCurrentStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              <span className="ml-2 text-sm text-muted-foreground">
                Step {currentStep + 1} of 3
              </span>
            </div>
            {currentStep < 2 ? (
              <Button variant="brand" onClick={() => setCurrentStep((s) => s + 1)}>Next</Button>
            ) : (
              <Button variant="brand" onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save property"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
