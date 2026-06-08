"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Bold,
  Check,
  ChevronDown,
  Copy,
  DollarSign,
  ExternalLink,
  Globe,
  Home,
  Image as ImageIcon,
  Italic,
  KeyRound,
  Link2,
  List,
  ListOrdered,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Quote,
  Search,
  SlidersHorizontal,
  Tag as TagIcon,
  Type,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import MainLayout from "@/components/layout/main-layout";
import AddressAutocomplete from "@/components/properties/address-autocomplete";
import MapPreview from "@/components/properties/map-preview";
import TagSelector from "@/components/buyers/tag-selector";
import SortableImageGrid, { type ImageItem } from "@/components/properties/sortable-image-grid";
import { PropertyService } from "@/services/property-service";
import { BuyerService } from "@/services/buyer-service";
import type { Buyer } from "@/lib/supabase";
import { PROPERTY_TYPES } from "@/lib/constant";
import { cn } from "@/lib/utils";
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
const CONSTRUCTION_TYPES = [
  { value: "", label: "Not sure / leave blank" },
  { value: "Wood-frame (stick-built)", label: "Wood-frame (stick-built)" },
  { value: "Concrete block / masonry", label: "Concrete block / masonry" },
  { value: "Steel-frame", label: "Steel-frame" },
  { value: "Insulated concrete forms (ICF)", label: "Insulated concrete forms (ICF)" },
  { value: "Manufactured / modular", label: "Manufactured / modular" },
];

export interface PropertyEditorData {
  id?: string;
  slug?: string | null;
}

type ExistingImage = { id: string; image_url: string; sort_order: number; is_featured: boolean };

const toNum = (value: string) => {
  if (!value || !value.trim()) return null;
  const n = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

function SectionLabel({ icon: Icon, children, badge }: { icon: typeof Home; children: React.ReactNode; badge?: { text: string; tone: "internal" | "public" } }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/10 text-brand">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm font-semibold text-foreground">{children}</span>
      {badge ? (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            badge.tone === "internal" ? "bg-muted text-muted-foreground" : "bg-brand/10 text-brand",
          )}
        >
          {badge.text}
        </span>
      ) : null}
    </div>
  );
}

function SegButton({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {children}
    </button>
  );
}

const SECTIONS = [
  { id: "property", label: "Property" },
  { id: "deal", label: "The deal" },
  { id: "listing", label: "Listing" },
];

export default function PropertyEditor({ mode, propertyId }: { mode: "create" | "edit"; propertyId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const descRef = useRef<HTMLDivElement | null>(null);
  const descInitialized = useRef(false);

  const [savedId, setSavedId] = useState<string | null>(mode === "edit" ? propertyId ?? null : null);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [primarySiteHost, setPrimarySiteHost] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [showOnSite, setShowOnSite] = useState(true); // desired publish state
  const [savedShowOnSite, setSavedShowOnSite] = useState(false); // last-persisted publish state
  const [stagedPhotos, setStagedPhotos] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [matchedBuyers, setMatchedBuyers] = useState<Buyer[]>([]);
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const initialBuyers = useRef<string[]>([]);

  const [form, setForm] = useState({
    address: "",
    city: "",
    state: "",
    zip: "",
    property_type: "",
    bedrooms: "",
    bathrooms: "",
    sqft: "",
    year_built: "",
    lot_size: "",
    mls_number: "",
    construction_type: "",
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
    internal_notes: "",
    photo_album_url: "",
    video_link: "",
    website_url: "",
  });

  const handleChange = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const numericPrice = form.price ? Number(form.price.replace(/[^\d]/g, "")) : undefined;
  const numericBuyPrice = form.buy_price ? Number(form.buy_price.replace(/[^\d]/g, "")) : undefined;
  const isCreative = form.deal_type === "creative";
  const isVacant = form.occupancy.toLowerCase() === "vacant";

  // Resolve the org's primary published site host for the Copy link control.
  useEffect(() => {
    fetch("/api/sites")
      .then((r) => (r.ok ? r.json() : { sites: [] }))
      .then(({ sites }) => {
        const list = (sites || []) as Array<{ slug: string; status: string; custom_domain?: string }>;
        const active = list.find((s) => s.status === "published") || list[0];
        if (active) setPrimarySiteHost(active.custom_domain || `${active.slug}.listhit.io`);
      })
      .catch(() => {});
  }, []);

  // Edit mode: hydrate from the saved property.
  useEffect(() => {
    if (mode !== "edit" || !propertyId) return;
    let active = true;
    (async () => {
      const p = await PropertyService.getProperty(propertyId).catch(() => null);
      if (!active || !p) return;
      const anyP = p as any;
      setForm({
        address: p.address ?? "",
        city: p.city ?? "",
        state: p.state ?? "",
        zip: p.zip ?? "",
        property_type: p.property_type ?? "",
        bedrooms: p.bedrooms?.toString() ?? "",
        bathrooms: p.bathrooms?.toString() ?? "",
        sqft: p.sqft?.toString() ?? "",
        year_built: anyP.year_built?.toString() ?? "",
        lot_size: anyP.lot_size ?? "",
        mls_number: anyP.mls_number ?? "",
        construction_type: anyP.construction_type ?? "",
        price: p.price?.toString() ?? "",
        buy_price: anyP.buy_price ? String(anyP.buy_price) : "",
        deal_type: p.deal_type ?? "cash",
        finance_subtype: p.finance_subtype ?? "",
        down_payment: anyP.down_payment?.toString() ?? "",
        monthly_payment: anyP.monthly_payment?.toString() ?? "",
        interest_rate: anyP.interest_rate?.toString() ?? "",
        term_months: anyP.term_months?.toString() ?? "",
        balloon_months: anyP.balloon_months?.toString() ?? "",
        existing_loan_balance: anyP.existing_loan_balance?.toString() ?? "",
        lockbox_code: anyP.lockbox_code ?? "",
        condition: p.condition ?? "",
        status: p.status ?? "available",
        disposition_strategy: anyP.disposition_strategy ?? "",
        buyer_fit: anyP.buyer_fit ?? "",
        occupancy: anyP.occupancy ?? "",
        priority: anyP.priority ?? "",
        tags: p.tags ?? [],
        internal_notes: anyP.internal_notes ?? "",
        photo_album_url: anyP.photo_album_url ?? "",
        video_link: p.video_link ?? "",
        website_url: p.website_url ?? "",
      });
      setCoords({ lat: p.latitude ?? null, lng: p.longitude ?? null });
      setShowOnSite(anyP.show_on_site !== false);
      setSavedShowOnSite(anyP.show_on_site !== false);
      setPublicSlug(anyP.slug ?? null);
      // Description HTML is set into the contentEditable region once.
      if (descRef.current && !descInitialized.current) {
        descRef.current.innerHTML = p.description ?? "";
        descInitialized.current = true;
      }
      const buyers = await PropertyService.getPropertyBuyers(propertyId).catch(() => []);
      if (!active) return;
      setSelectedBuyers(buyers);
      initialBuyers.current = buyers;
      await refreshImages(propertyId);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, propertyId]);

  // Matched buyers — fire on any usable signal.
  useEffect(() => {
    const creative = form.deal_type === "creative";
    const hasSignal = form.city || form.state || form.property_type || numericPrice || form.buyer_fit || creative;
    if (!hasSignal) return setMatchedBuyers([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.city, form.state, form.property_type, numericPrice, form.buyer_fit, form.deal_type, form.tags]);

  const stagedPreviews = useMemo(
    () => stagedPhotos.map((photo) => ({ name: photo.name, url: URL.createObjectURL(photo) })),
    [stagedPhotos],
  );
  useEffect(() => () => stagedPreviews.forEach((p) => URL.revokeObjectURL(p.url)), [stagedPreviews]);

  // Image tiles: real rows once a property id exists, otherwise staged previews.
  const imageItems: ImageItem[] = useMemo(() => {
    if (savedId) {
      return [...existingImages]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((img) => ({ id: img.id, url: img.image_url, isNew: false, isFeatured: img.is_featured }));
    }
    return stagedPreviews.map((p, i) => ({ id: `new-${i}`, url: p.url, isNew: true, isFeatured: i === 0, label: p.name }));
  }, [savedId, existingImages, stagedPreviews]);

  const imageCount = savedId ? existingImages.length : stagedPhotos.length;
  const hasCover = imageCount > 0;
  const hasAddress = form.address.trim().length > 0;
  const hasPrice = Boolean(numericPrice);
  const canPublish = hasAddress && hasPrice && hasCover;
  const missing = [!hasAddress && "address", !hasPrice && (isCreative ? "list price" : "asking price"), !hasCover && "a cover photo"].filter(Boolean) as string[];

  async function refreshImages(id: string) {
    const images = await PropertyService.getImages(id).catch(() => []);
    setExistingImages(
      images.map((img) => ({ id: img.id, image_url: img.image_url, sort_order: img.sort_order, is_featured: img.is_featured })),
    );
  }

  const adjustNumberField = (field: "bedrooms" | "bathrooms", delta: number) =>
    handleChange(field, String(Math.max(0, Number(form[field] || "0") + delta)));
  const formatPrice = (field: "price" | "buy_price") => {
    const value = field === "price" ? numericPrice : numericBuyPrice;
    handleChange(field, value ? value.toLocaleString() : "");
  };

  // Rich-text toolbar (no new dependency — uses execCommand on a contentEditable).
  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    descRef.current?.focus();
  };
  const addLink = () => {
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  };

  // Upload handling: stage in memory pre-save (create), upload immediately once
  // a property id exists. Bytes go browser → Storage via the signed-URL route.
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files);
      if (!savedId) {
        setStagedPhotos((prev) => [...prev, ...list].slice(0, 50));
        return;
      }
      if (existingImages.length + list.length > 50) {
        toast.error("Up to 50 photos per property");
        return;
      }
      setUploading(true);
      try {
        const { errors } = await PropertyService.uploadImages(savedId, list);
        if (errors.length) toast.warning(`Some photos failed: ${errors.join(", ")}`);
        await refreshImages(savedId);
      } catch (e) {
        console.error(e);
        toast.error("Photo upload failed");
      } finally {
        setUploading(false);
      }
    },
    [savedId, existingImages.length],
  );

  const handleReorder = async (reordered: ImageItem[]) => {
    if (savedId) {
      const order = reordered.map((item, i) => ({ id: item.id, sort_order: i }));
      setExistingImages((prev) =>
        prev.map((img) => ({ ...img, sort_order: order.find((o) => o.id === img.id)?.sort_order ?? img.sort_order })),
      );
      await PropertyService.reorderImages(savedId, order).catch((e) => {
        console.error(e);
        toast.error("Failed to reorder photos");
      });
    } else {
      const next = reordered
        .map((item) => stagedPhotos[parseInt(item.id.replace("new-", ""), 10)])
        .filter((f): f is File => Boolean(f));
      setStagedPhotos(next);
    }
  };

  const handleSetFeatured = async (id: string) => {
    if (!savedId) {
      // Pre-save: move the chosen staged photo to the front (cover = first).
      const idx = parseInt(id.replace("new-", ""), 10);
      setStagedPhotos((prev) => {
        if (idx <= 0 || idx >= prev.length) return prev;
        const next = [...prev];
        const [moved] = next.splice(idx, 1);
        next.unshift(moved);
        return next;
      });
      return;
    }
    setExistingImages((prev) => prev.map((img) => ({ ...img, is_featured: img.id === id })));
    await PropertyService.setFeaturedImage(savedId, id).catch((e) => {
      console.error(e);
      toast.error("Failed to set cover photo");
    });
  };

  const handleDeleteImage = async (id: string) => {
    if (!savedId) {
      const idx = parseInt(id.replace("new-", ""), 10);
      setStagedPhotos((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    setExistingImages((prev) => prev.filter((img) => img.id !== id));
    await PropertyService.deleteImageViaApi(savedId, id).catch((e) => {
      console.error(e);
      toast.error("Failed to delete photo");
    });
  };

  function buildPayload(publish: boolean): Record<string, any> {
    const creative = form.deal_type === "creative";
    return {
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
      existing_loan_balance: creative && form.finance_subtype === "subject_to" ? toNum(form.existing_loan_balance) : null,
      lockbox_code: isVacant ? form.lockbox_code || null : null,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      sqft: form.sqft ? Number(form.sqft) : null,
      property_type: form.property_type || null,
      year_built: form.year_built ? Number(form.year_built.replace(/[^\d]/g, "")) : null,
      lot_size: form.lot_size || null,
      mls_number: form.mls_number || null,
      construction_type: form.construction_type || null,
      condition: form.condition || null,
      status: form.status,
      disposition_strategy: form.disposition_strategy || null,
      buyer_fit: form.buyer_fit || null,
      occupancy: form.occupancy || null,
      priority: form.priority || null,
      tags: form.tags.length > 0 ? form.tags : null,
      // Public listing copy vs private internal notes — kept strictly separate.
      description: descRef.current?.innerHTML || null,
      internal_notes: form.internal_notes || null,
      photo_album_url: form.photo_album_url || null,
      video_link: form.video_link || null,
      website_url: form.website_url || null,
      show_on_site: publish,
      latitude: coords.lat,
      longitude: coords.lng,
    };
  }

  async function persistBuyers(id: string) {
    const added = selectedBuyers.filter((b) => !initialBuyers.current.includes(b));
    const removed = initialBuyers.current.filter((b) => !selectedBuyers.includes(b));
    for (const b of added) await PropertyService.addBuyerToProperty(id, b).catch(console.error);
    for (const b of removed) await PropertyService.removeBuyerFromProperty(id, b).catch(console.error);
    initialBuyers.current = selectedBuyers;
  }

  const handleSave = async () => {
    if (!hasAddress) {
      toast.error("Address is required");
      return;
    }
    const publish = showOnSite && canPublish;
    setSaving(true);
    try {
      const payload = buildPayload(publish);
      if (!savedId) {
        const created = (await PropertyService.addProperty(payload)) as any;
        const newId = created.id as string;
        setSavedId(newId);
        setPublicSlug(created.slug ?? null);
        if (stagedPhotos.length > 0) {
          setUploading(true);
          const { errors } = await PropertyService.uploadImages(newId, stagedPhotos).catch(() => ({ errors: ["upload failed"] }));
          if (errors.length) toast.warning(`Some photos failed: ${errors.join(", ")}`);
          setStagedPhotos([]);
          await refreshImages(newId);
          setUploading(false);
        }
        await persistBuyers(newId);
        setSavedShowOnSite(publish);
        toast.success(publish ? "Property published" : "Property saved as draft");
        queryClient.invalidateQueries({ queryKey: ["properties"] });
        router.replace(`/properties/edit/${newId}`);
      } else {
        const updated = (await PropertyService.updateProperty(savedId, payload)) as any;
        setPublicSlug(updated.slug ?? publicSlug);
        await persistBuyers(savedId);
        setSavedShowOnSite(publish);
        toast.success(publish ? "Property published" : "Property saved");
        queryClient.invalidateQueries({ queryKey: ["properties"] });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save property");
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = publicSlug
    ? `https://${primarySiteHost || `${publicSlug}.listhit.io`}/properties/${publicSlug}`
    : null;

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const scrollTo = (id: string) => document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const toolbarBtn = (onClick: () => void, icon: React.ReactNode, label: string) => (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} title={label} aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
      {icon}
    </button>
  );

  const showPublicControls = savedShowOnSite && !!savedId && !!publicUrl;

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-5 p-4">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight">{form.address.trim() || "Add property"}</h1>
              {showPublicControls ? (
                <p className="truncate font-mono text-xs text-muted-foreground">{publicUrl?.replace("https://", "")}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Draft / Live toggle */}
              <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
                <SegButton active={!showOnSite} onClick={() => setShowOnSite(false)}>Draft</SegButton>
                <SegButton active={showOnSite} disabled={!canPublish && !showOnSite} onClick={() => canPublish && setShowOnSite(true)}>Live</SegButton>
              </div>
              {showPublicControls ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                    {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy link</>}
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <a href={publicUrl!} target="_blank" rel="noreferrer">Open preview <ExternalLink className="h-3.5 w-3.5" /></a>
                  </Button>
                </>
              ) : null}
              <Button type="button" variant="brand" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : showOnSite && canPublish ? "Save & publish" : "Save"}
              </Button>
            </div>
          </div>
          {showOnSite && !canPublish ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Add {missing.join(", ")} to publish. Saving now keeps it as a draft.
            </p>
          ) : null}
          {/* Quick-nav chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" onClick={() => scrollTo(s.id)}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/60">
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section: Property details */}
        <Card id="section-property" className="scroll-mt-32 border-border">
          <CardContent className="grid gap-6 p-5 md:grid-cols-2">
            <div className="space-y-5">
              <SectionLabel icon={Home}>Property details</SectionLabel>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Address <span className="text-brand">*</span></Label>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <Search className="h-4 w-4" />
                    <span className="text-xs">Search property address</span>
                  </div>
                  <AddressAutocomplete
                    value={{ address: form.address, city: form.city, state: form.state, zip: form.zip }}
                    onSelect={(val) => {
                      handleChange("address", val.address);
                      handleChange("city", val.city);
                      handleChange("state", val.state);
                      handleChange("zip", val.zip);
                      setCoords({ lat: val.latitude, lng: val.longitude });
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label className="text-sm">City</Label><Input className="h-9" value={form.city} placeholder="Austin" onChange={(e) => handleChange("city", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-sm">State</Label><Input className="h-9" value={form.state} placeholder="TX" onChange={(e) => handleChange("state", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-sm">Zip</Label><Input className="h-9" value={form.zip} placeholder="78701" onChange={(e) => handleChange("zip", e.target.value)} /></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Property type</Label>
                <Select value={form.property_type} onValueChange={(v) => handleChange("property_type", v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select property type" /></SelectTrigger>
                  <SelectContent>{PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Bedrooms</Label>
                  <div className="flex">
                    <Button type="button" variant="outline" size="icon" className="h-9" onClick={() => adjustNumberField("bedrooms", -1)}><Minus className="h-4 w-4" /></Button>
                    <Input value={form.bedrooms} className="h-9 rounded-none text-center" onChange={(e) => handleChange("bedrooms", e.target.value)} />
                    <Button type="button" variant="outline" size="icon" className="h-9" onClick={() => adjustNumberField("bedrooms", 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Bathrooms</Label>
                  <div className="flex">
                    <Button type="button" variant="outline" size="icon" className="h-9" onClick={() => adjustNumberField("bathrooms", -1)}><Minus className="h-4 w-4" /></Button>
                    <Input value={form.bathrooms} className="h-9 rounded-none text-center" onChange={(e) => handleChange("bathrooms", e.target.value)} />
                    <Button type="button" variant="outline" size="icon" className="h-9" onClick={() => adjustNumberField("bathrooms", 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-1.5"><Label className="text-sm">Square feet</Label><Input className="h-9" value={form.sqft} placeholder="1,850" onChange={(e) => handleChange("sqft", e.target.value)} /></div>
              </div>

              {/* Collapsible more details */}
              <div className="rounded-lg border border-border">
                <button type="button" onClick={() => setMoreOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-foreground">
                  More details (handy for agents &amp; land)
                  <ChevronDown className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")} />
                </button>
                {moreOpen ? (
                  <div className="grid grid-cols-2 gap-3 border-t border-border p-3">
                    <div className="space-y-1.5"><Label className="text-sm">Year built</Label><Input className="h-9" value={form.year_built} placeholder="1998" onChange={(e) => handleChange("year_built", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-sm">Lot size</Label><Input className="h-9" value={form.lot_size} placeholder="0.25 ac" onChange={(e) => handleChange("lot_size", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-sm">MLS #</Label><Input className="h-9" value={form.mls_number} placeholder="1234567" onChange={(e) => handleChange("mls_number", e.target.value)} /></div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Construction</Label>
                      <Select value={form.construction_type} onValueChange={(v) => handleChange("construction_type", v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Not sure / leave blank" /></SelectTrigger>
                        <SelectContent>{CONSTRUCTION_TYPES.filter((c) => c.value).map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="space-y-3">
              <SectionLabel icon={MapPin}>Map preview</SectionLabel>
              {MAPBOX_TOKEN ? (
                <MapPreview latitude={coords.lat} longitude={coords.lng} className="h-[300px] overflow-hidden rounded-xl shadow-sm" />
              ) : (
                <div className="flex h-[300px] items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground"><MapPin className="mr-2 h-5 w-5" /> Enter an address to see the map</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section: The deal (internal) */}
        <Card id="section-deal" className="scroll-mt-32 border-border">
          <CardContent className="grid gap-6 p-5 md:grid-cols-2">
            <div className="space-y-5">
              <SectionLabel icon={Banknote} badge={{ text: "Internal · never shown on your site", tone: "internal" }}>The deal</SectionLabel>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                <SegButton active={!isCreative} onClick={() => handleChange("deal_type", "cash")}>Cash deal</SegButton>
                <SegButton active={isCreative} onClick={() => handleChange("deal_type", "creative")}>Creative finance</SegButton>
              </div>
              {!isCreative ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Asking price</Label>
                    <div className="relative"><DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-10 pl-9 text-lg" placeholder="125,000" value={form.price} onBlur={() => formatPrice("price")} onChange={(e) => handleChange("price", e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Buy price</Label>
                    <div className="relative"><DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-10 pl-9 text-lg" placeholder="100,000" value={form.buy_price} onBlur={() => formatPrice("buy_price")} onChange={(e) => handleChange("buy_price", e.target.value)} /></div>
                    <p className="text-xs text-muted-foreground">Your cost basis — internal only.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Creative type</Label>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                      {FINANCE_SUBTYPES.map((st) => <SegButton key={st.value} active={form.finance_subtype === st.value} onClick={() => handleChange("finance_subtype", st.value)}>{st.label}</SegButton>)}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">List price</Label>
                    <div className="relative"><DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-10 pl-9 text-lg" placeholder="125,000" value={form.price} onBlur={() => formatPrice("price")} onChange={(e) => handleChange("price", e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-sm">Down payment</Label><Input className="h-9" placeholder="10,000" value={form.down_payment} onChange={(e) => handleChange("down_payment", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-sm">Monthly payment</Label><Input className="h-9" placeholder="1,200" value={form.monthly_payment} onChange={(e) => handleChange("monthly_payment", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-sm">Interest rate %</Label><Input className="h-9" placeholder="6.5" value={form.interest_rate} onChange={(e) => handleChange("interest_rate", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-sm">Term (mo)</Label><Input className="h-9" placeholder="360" value={form.term_months} onChange={(e) => handleChange("term_months", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-sm">Balloon (mo)</Label><Input className="h-9" placeholder="60" value={form.balloon_months} onChange={(e) => handleChange("balloon_months", e.target.value)} /></div>
                    {form.finance_subtype === "subject_to" ? (
                      <div className="space-y-1.5"><Label className="text-sm">Existing loan balance</Label><Input className="h-9" placeholder="180,000" value={form.existing_loan_balance} onChange={(e) => handleChange("existing_loan_balance", e.target.value)} /></div>
                    ) : null}
                  </div>
                </div>
              )}

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
                    <div className="col-span-2 space-y-1.5"><Label className="text-sm">Lockbox code</Label><div className="relative"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-9 pl-9" placeholder="e.g. 1234" value={form.lockbox_code} onChange={(e) => handleChange("lockbox_code", e.target.value)} /></div></div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <SectionLabel icon={TagIcon}>Tags &amp; internal notes</SectionLabel>
                <div className="rounded-lg border border-border bg-muted/10 p-3"><TagSelector value={form.tags} onChange={(v) => handleChange("tags", v)} allowCreate={true} /></div>
                <Textarea rows={4} placeholder="Private notes — access details, seller motivation, selling angle. Never shown on your site." value={form.internal_notes} onChange={(e) => handleChange("internal_notes", e.target.value)} />
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
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">{`${b.fname?.[0] || ""}${b.lname?.[0] || ""}`.toUpperCase() || "?"}</div>
                          <div className="min-w-0"><p className="truncate font-medium text-foreground">{b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed buyer"}</p><p className="truncate text-xs text-muted-foreground">{b.mailing_city || "Any city"}{b.mailing_state ? `, ${b.mailing_state}` : ""}</p></div>
                        </div>
                        <Checkbox checked={selectedBuyers.includes(b.id)} onCheckedChange={() => setSelectedBuyers((prev) => prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id])} />
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section: Listing (public) */}
        <Card id="section-listing" className="scroll-mt-32 border-border">
          <CardContent className="space-y-6 p-5">
            <SectionLabel icon={Globe} badge={{ text: "Shown on your website", tone: "public" }}>Listing</SectionLabel>

            {/* Rich-text description */}
            <div className="space-y-2">
              <Label className="text-sm">Public description</Label>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1">
                  {toolbarBtn(() => exec("bold"), <Bold className="h-4 w-4" />, "Bold")}
                  {toolbarBtn(() => exec("italic"), <Italic className="h-4 w-4" />, "Italic")}
                  {toolbarBtn(() => exec("formatBlock", "H3"), <Type className="h-4 w-4" />, "Heading")}
                  {toolbarBtn(() => exec("insertUnorderedList"), <List className="h-4 w-4" />, "Bullet list")}
                  {toolbarBtn(() => exec("insertOrderedList"), <ListOrdered className="h-4 w-4" />, "Numbered list")}
                  {toolbarBtn(() => exec("formatBlock", "BLOCKQUOTE"), <Quote className="h-4 w-4" />, "Quote")}
                  {toolbarBtn(addLink, <Link2 className="h-4 w-4" />, "Link")}
                </div>
                <div
                  ref={descRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  className="min-h-[180px] px-3 py-2 text-sm leading-relaxed outline-none [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                />
              </div>
              <p className="text-xs text-muted-foreground">This is the public listing copy buyers see on your site.</p>
            </div>

            {/* Photos */}
            <div className="space-y-3">
              <SectionLabel icon={ImageIcon}>Photos</SectionLabel>
              <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <button type="button" onClick={() => fileInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 text-muted-foreground transition-colors hover:border-brand/50 hover:bg-muted/30">
                {uploading ? <Loader2 className="mb-2 h-5 w-5 animate-spin" /> : <Upload className="mb-2 h-5 w-5" />}
                <span className="text-sm">{uploading ? "Uploading…" : "Drag photos here or click to browse"}</span>
                <span className="mt-1 text-xs text-muted-foreground/60">JPEG, PNG, WebP — up to 50 photos. Tap the star to set the cover.</span>
              </button>
              <SortableImageGrid items={imageItems} onReorder={handleReorder} onSetFeatured={handleSetFeatured} onDelete={handleDeleteImage} />
            </div>

            {/* Links */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-sm">Photo album link — Google Drive / Dropbox</Label><Input className="h-9" placeholder="https://drive.google.com/…" value={form.photo_album_url} onChange={(e) => handleChange("photo_album_url", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-sm">Video link (YouTube)</Label><Input className="h-9" placeholder="https://youtube.com/…" value={form.video_link} onChange={(e) => handleChange("video_link", e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pb-10">
          <Button type="button" variant="ghost" onClick={() => router.push("/properties")}>Cancel</Button>
          <Button type="button" variant="brand" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : showOnSite && canPublish ? "Save & publish" : "Save"}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
