"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { Check, DollarSign, Globe, Loader2, MapPin, Minus, Play, Plus, Search, Upload, X } from "lucide-react"
import MainLayout from "@/components/layout/main-layout"
import AddressAutocomplete from "@/components/properties/address-autocomplete"
import MapPreview from "@/components/properties/map-preview"
import TagSelector from "@/components/buyers/tag-selector"
import { PropertyService } from "@/services/property-service"
import { BuyerService } from "@/services/buyer-service"
import type { Buyer, Property } from "@/lib/supabase"
import { PROPERTY_TYPES } from "@/lib/constant"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const STEPS = ["Property Details", "Disposition & Pricing", "Photos & Links"]
const STATUSES = ["available", "under_contract", "sold"]
const CONDITIONS = ["Turnkey", "Light Rehab", "Full Rehab"]
const STRATEGIES = ["Wholesale", "Flip", "Owner Finance"]
const BUYER_FITS = ["Cash Buyer", "Landlord", "Fix & Flip"]
const OCCUPANCIES = ["Vacant", "Tenant", "Owner-Occupied"]
const PRIORITIES = ["High", "Medium", "Low"]

export default function EditPropertyPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [similarProperty, setSimilarProperty] = useState<Property | null>(null)
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null })
  const [matchedBuyers, setMatchedBuyers] = useState<Buyer[]>([])
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([])
  const [form, setForm] = useState({ address: "", city: "", state: "", zip: "", property_type: "", bedrooms: "", bathrooms: "", sqft: "", price: "", condition: "", status: "available", disposition_strategy: "", buyer_fit: "", occupancy: "", priority: "", tags: [] as string[], notes: "", video_link: "", website_url: "", short_slug: "" })

  const handleChange = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [field]: value }))
  const debouncedAddress = useDebounce(`${form.address}|${form.city}|${form.zip}`, 400)
  const numericPrice = form.price ? Number(form.price.replace(/[^\d]/g, "")) : undefined
  const photoPreviews = useMemo(() => photos.map((photo) => ({ name: photo.name, url: URL.createObjectURL(photo) })), [photos])

  useEffect(() => () => photoPreviews.forEach((p) => URL.revokeObjectURL(p.url)), [photoPreviews])
  useEffect(() => {
    if (form.address.trim().length < 5) return setSimilarProperty(null)
    PropertyService.findByAddress(form.address, form.city || null, form.zip || null).then(setSimilarProperty).catch(() => setSimilarProperty(null))
  }, [debouncedAddress, form.address, form.city, form.zip])

  useEffect(() => {
    if (!form.city && !form.state && !form.property_type && !numericPrice) return setMatchedBuyers([])
    BuyerService.getBuyersByCriteria({ city: form.city || undefined, state: form.state || undefined, propertyType: form.property_type || undefined, minPrice: numericPrice, maxPrice: numericPrice }).then(setMatchedBuyers).catch(() => setMatchedBuyers([]))
  }, [form.city, form.state, form.property_type, numericPrice])


  useEffect(() => {
    const fetchProperty = async () => {
      const property = await PropertyService.getProperty(id)
      if (!property) return
      setForm({ address: property.address, city: property.city ?? "", state: property.state ?? "", zip: property.zip ?? "", property_type: property.property_type ?? "", bedrooms: property.bedrooms?.toString() ?? "", bathrooms: property.bathrooms?.toString() ?? "", sqft: property.sqft?.toString() ?? "", price: property.price?.toString() ?? "", condition: property.condition ?? "", status: property.status, disposition_strategy: property.disposition_strategy ?? "", buyer_fit: property.buyer_fit ?? "", occupancy: property.occupancy ?? "", priority: property.priority ?? "", tags: property.tags ?? [], notes: property.description ?? "", video_link: property.video_link ?? "", website_url: property.website_url ?? "", short_slug: property.short_slug ?? "" })
      setCoords({ lat: property.latitude ?? null, lng: property.longitude ?? null })
      setSelectedBuyers(await PropertyService.getPropertyBuyers(id).catch(() => []))
    }
    fetchProperty().catch(console.error)
  }, [id])
  const toggleBuyer = (id: string) => setSelectedBuyers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const adjustNumberField = (field: "bedrooms" | "bathrooms", delta: number) => handleChange(field, String(Math.max(0, Number(form[field] || "0") + delta)))
  const formatPrice = () => handleChange("price", numericPrice ? numericPrice.toLocaleString() : "")
  const handleDropFiles = (files: FileList | null) => files && setPhotos((prev) => [...prev, ...Array.from(files)])

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const existing = await PropertyService.findByAddress(form.address, form.city || null, form.zip || null)
      if (existing) return toast.error("Property already exists at this address")
      await PropertyService.updateProperty(id, { address: form.address, city: form.city || null, state: form.state || null, zip: form.zip || null, price: numericPrice ?? null, bedrooms: form.bedrooms ? Number(form.bedrooms) : null, bathrooms: form.bathrooms ? Number(form.bathrooms) : null, sqft: form.sqft ? Number(form.sqft) : null, property_type: form.property_type || null, condition: form.condition || null, status: form.status, disposition_strategy: form.disposition_strategy || null, buyer_fit: form.buyer_fit || null, occupancy: form.occupancy || null, priority: form.priority || null, description: form.notes || null, tags: form.tags.length > 0 ? form.tags : null, video_link: form.video_link || null, website_url: form.website_url || null, short_slug: form.short_slug || null, latitude: coords.lat, longitude: coords.lng })
      for (const buyerId of selectedBuyers) await PropertyService.addBuyerToProperty(id, buyerId).catch(console.error)
      toast.success("Property updated")
      queryClient.invalidateQueries({ queryKey: ["properties"] })
      router.push(`/properties/${id}`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to add property")
    } finally { setLoading(false) }
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4">
        <h1 className="text-3xl font-bold">Edit Property</h1>
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-6 flex items-center justify-between gap-4">{STEPS.map((s, i) => <button key={s} type="button" onClick={() => setCurrentStep(i)} className="flex flex-1 items-center gap-3 text-left"><div className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${i < currentStep ? "border-emerald-500 bg-emerald-500 text-white" : i === currentStep ? "border-blue-500 bg-blue-50 text-blue-700" : "border-muted-foreground/30 text-muted-foreground"}`}>{i < currentStep ? <Check className="h-4 w-4" /> : i + 1}</div><span className="text-sm font-medium">{s}</span>{i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}</button>)}</div>

          {currentStep === 0 && <Card><CardHeader><CardTitle>Property Details</CardTitle></CardHeader><CardContent className="grid gap-6 md:grid-cols-2"><div className="space-y-5"><div className="space-y-2"><Label className="text-sm font-medium">Address <span className="text-red-500">*</span></Label><div className="rounded-lg border bg-background px-3 py-2"><div className="mb-2 flex items-center gap-2 text-muted-foreground"><Search className="h-4 w-4" /><span className="text-xs">Search property address</span></div><AddressAutocomplete value={{ address: form.address, city: form.city, state: form.state, zip: form.zip }} onSelect={(val) => { handleChange("address", val.address); handleChange("city", val.city); handleChange("state", val.state); handleChange("zip", val.zip); setCoords({ lat: val.latitude, lng: val.longitude }) }} /></div>{similarProperty && <Alert variant="destructive"><AlertTitle>Possible Duplicate</AlertTitle><AlertDescription>A similar property exists at <Link href={`/properties/${similarProperty.id}`} className="underline">{similarProperty.address}</Link>.</AlertDescription></Alert>}</div><div className="grid grid-cols-3 gap-3"><div><Label>City</Label><Input value={form.city} placeholder="Austin" onChange={(e) => handleChange("city", e.target.value)} /></div><div><Label>State</Label><Input value={form.state} placeholder="TX" onChange={(e) => handleChange("state", e.target.value)} /></div><div><Label>Zip</Label><Input value={form.zip} placeholder="78701" onChange={(e) => handleChange("zip", e.target.value)} /></div></div><div><Label>Property Type</Label><Select value={form.property_type} onValueChange={(v) => handleChange("property_type", v)}><SelectTrigger><SelectValue placeholder="Select property type" /></SelectTrigger><SelectContent>{PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-3 gap-3"><div><Label>Bedrooms</Label><div className="flex"><Button type="button" variant="outline" size="icon" onClick={() => adjustNumberField("bedrooms", -1)}><Minus className="h-4 w-4" /></Button><Input value={form.bedrooms} className="rounded-none text-center" onChange={(e) => handleChange("bedrooms", e.target.value)} /><Button type="button" variant="outline" size="icon" onClick={() => adjustNumberField("bedrooms", 1)}><Plus className="h-4 w-4" /></Button></div></div><div><Label>Bathrooms</Label><div className="flex"><Button type="button" variant="outline" size="icon" onClick={() => adjustNumberField("bathrooms", -1)}><Minus className="h-4 w-4" /></Button><Input value={form.bathrooms} className="rounded-none text-center" onChange={(e) => handleChange("bathrooms", e.target.value)} /><Button type="button" variant="outline" size="icon" onClick={() => adjustNumberField("bathrooms", 1)}><Plus className="h-4 w-4" /></Button></div></div><div><Label>Square Feet</Label><Input value={form.sqft} placeholder="1,850" onChange={(e) => handleChange("sqft", e.target.value)} /></div></div></div><div><h3 className="mb-2 text-lg font-semibold">Map Preview</h3>{MAPBOX_TOKEN ? <MapPreview latitude={coords.lat} longitude={coords.lng} className="h-[300px] overflow-hidden rounded-xl shadow-sm" /> : <div className="flex h-[300px] items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground"><MapPin className="mr-2 h-5 w-5" />Enter an address to see the map</div>}</div></CardContent></Card>}

          {currentStep === 1 && <Card><CardHeader><CardTitle>Disposition & Pricing</CardTitle></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label>Asking Price</Label><div className="relative"><DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9 text-lg" placeholder="125,000" value={form.price} onBlur={formatPrice} onChange={(e) => handleChange("price", e.target.value)} /></div></div><div className="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2"><div><Label>Condition</Label><Select value={form.condition} onValueChange={(v) => handleChange("condition", v)}><SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger><SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div><div><Label>Status</Label><Select value={form.status} onValueChange={(v) => handleChange("status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><div><Label>Strategy</Label><Select value={form.disposition_strategy} onValueChange={(v) => handleChange("disposition_strategy", v)}><SelectTrigger><SelectValue placeholder="Select strategy" /></SelectTrigger><SelectContent>{STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><div><Label>Buyer Fit</Label><Select value={form.buyer_fit} onValueChange={(v) => handleChange("buyer_fit", v)}><SelectTrigger><SelectValue placeholder="Select buyer fit" /></SelectTrigger><SelectContent>{BUYER_FITS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-3 md:grid-cols-2"><div><Label>Occupancy</Label><Select value={form.occupancy} onValueChange={(v) => handleChange("occupancy", v)}><SelectTrigger><SelectValue placeholder="Select occupancy" /></SelectTrigger><SelectContent>{OCCUPANCIES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div><div><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => handleChange("priority", v)}><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div></div><div><Label>Tags</Label><div className="mt-1 rounded-lg border bg-muted/10 p-3"><TagSelector value={form.tags} onChange={(v) => handleChange("tags", v)} allowCreate={true} /></div></div><div><Label>Notes</Label><Textarea rows={4} placeholder="Add disposition notes, access details, or selling angle..." value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} /><p className="mt-1 text-right text-xs text-muted-foreground">{form.notes.length} characters</p></div><div><Label>Matched Buyers ({matchedBuyers.length})</Label><div className="mt-1 max-h-52 space-y-2 overflow-y-auto rounded-lg border p-3">{matchedBuyers.length === 0 ? <p className="text-sm text-muted-foreground">No matching buyers yet — fill in more details above to see matches</p> : matchedBuyers.map((b) => <label key={b.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/10 px-3 py-2 text-sm"><div><p className="font-medium">{b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed Buyer"}</p><p className="text-xs text-muted-foreground">{b.city || "Any City"}{b.state ? `, ${b.state}` : ""}</p></div><div className="flex items-center gap-2"><span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">Match</span><Checkbox checked={selectedBuyers.includes(b.id)} onCheckedChange={() => toggleBuyer(b.id)} /></div></label>)}</div></div></CardContent></Card>}

          {currentStep === 2 && <Card><CardHeader><CardTitle>Photos & Links</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label>Photo Uploads</Label><input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleDropFiles(e.target.files)} /><button type="button" onClick={() => fileInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleDropFiles(e.dataTransfer.files) }} className="mt-1 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-muted-foreground hover:bg-muted/30"><Upload className="mb-2 h-5 w-5" />Drag photos here or click to browse</button>{photoPreviews.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">{photoPreviews.map((p, i) => <div key={p.name + i} className="relative overflow-hidden rounded-lg border"><img src={p.url} alt={p.name} className="h-24 w-full object-cover" /><Button type="button" variant="destructive" size="icon" className="absolute right-1 top-1 h-6 w-6" onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button></div>)}</div>}</div><div className="grid gap-3"><div><Label>Video Link</Label><div className="relative"><Play className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="https://youtube.com/..." value={form.video_link} onChange={(e) => handleChange("video_link", e.target.value)} /></div></div><div><Label>Website URL</Label><div className="relative"><Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="https://yourpropertysite.com" value={form.website_url} onChange={(e) => handleChange("website_url", e.target.value)} /></div></div><div><Label>Short Link Slug</Label><div className="flex items-center rounded-md border bg-muted/10"><span className="px-3 text-sm text-muted-foreground">short.io/</span><Input className="border-0 bg-transparent" placeholder="123-main-st" value={form.short_slug} onChange={(e) => handleChange("short_slug", e.target.value)} /></div></div></div></CardContent></Card>}

          <div className="mt-4 flex items-center justify-between border-t pt-4"><div className="flex items-center gap-2"><Button variant="outline" onClick={() => router.push(`/properties/${id}`)}>Cancel</Button>{currentStep > 0 && <Button variant="outline" onClick={() => setCurrentStep((s) => s - 1)}>Back</Button>}<span className="ml-2 text-sm text-muted-foreground">Step {currentStep + 1} of 3</span></div>{currentStep < 2 ? <Button onClick={() => setCurrentStep((s) => s + 1)}>Next</Button> : <Button onClick={handleSubmit} disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Update Property"}</Button>}</div>
        </div>
      </div>
    </MainLayout>
  )
}
