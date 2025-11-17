"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import { PropertyService } from "@/services/property-service"
import { BuyerService } from "@/services/buyer-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import TagSelector from "@/components/buyers/tag-selector"
import { PROPERTY_TYPES } from "@/lib/constant"
import { toast } from "sonner"
import { Loader2, Home, Info, Image as ImageIcon } from "lucide-react"
import MapPreview from "@/components/properties/map-preview"
import AddressAutocomplete from "@/components/properties/address-autocomplete"
import { Checkbox } from "@/components/ui/checkbox"
import type { Buyer } from "@/lib/supabase"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

const STATUSES = ["available", "under_contract", "sold"]
const CONDITIONS = ["Turnkey", "Light Rehab", "Full Rehab"]
const STRATEGIES = ["Wholesale", "Flip", "Owner Finance"]
const BUYER_FITS = ["Cash Buyer", "Landlord", "Fix & Flip"]
const OCCUPANCIES = ["Vacant", "Tenant", "Owner-Occupied"]
const PRIORITIES = ["High", "Medium", "Low"]

const TABS = ["basic", "dispo", "media"]

export default function EditPropertyPage() {
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const id = params.id as string

  const [activeTab, setActiveTab] = useState("basic")
  const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState<FileList | null>(null)
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>(
    { lat: null, lng: null },
  )
  const [matchedBuyers, setMatchedBuyers] = useState<Buyer[]>([])
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([])
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
    short_slug: "",
  })

  useEffect(() => {
    const fetchProperty = async () => {
      const property = await PropertyService.getProperty(id)
      if (property) {
        setForm({
          address: property.address,
          city: property.city ?? "",
          state: property.state ?? "",
          zip: property.zip ?? "",
          property_type: property.property_type ?? "",
          bedrooms: property.bedrooms?.toString() ?? "",
          bathrooms: property.bathrooms?.toString() ?? "",
          sqft: property.sqft?.toString() ?? "",
          price: property.price?.toString() ?? "",
          condition: property.condition ?? "",
          status: property.status,
          disposition_strategy: property.disposition_strategy ?? "",
          buyer_fit: property.buyer_fit ?? "",
          occupancy: property.occupancy ?? "",
          priority: property.priority ?? "",
          tags: property.tags ?? [],
        notes: property.description ?? "",
        video_link: property.video_link ?? "",
        website_url: property.website_url ?? "",
        short_slug: property.short_slug ?? "",
      })
        setCoords({ lat: property.latitude ?? null, lng: property.longitude ?? null })
        try {
          const existingBuyers = await PropertyService.getPropertyBuyers(id)
          setSelectedBuyers(existingBuyers)
        } catch (err) {
          console.error("Error fetching property buyers:", err)
        }
      }
      setLoading(false)
    }
    fetchProperty()
  }, [id])


  useEffect(() => {
    if (!form.city && !form.state && !form.property_type && !form.price) {
      setMatchedBuyers([])
      return
    }
    BuyerService.getBuyersByCriteria({
      city: form.city || undefined,
      state: form.state || undefined,
      propertyType: form.property_type || undefined,
      minPrice: form.price ? Number(form.price) : undefined,
      maxPrice: form.price ? Number(form.price) : undefined,
    })
      .then((data) => setMatchedBuyers(data))
      .catch(() => setMatchedBuyers([]))
  }, [form.city, form.state, form.property_type, form.price])

  const handleChange = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    const idx = TABS.indexOf(activeTab)
    if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1])
  }

  const handlePrev = () => {
    const idx = TABS.indexOf(activeTab)
    if (idx > 0) setActiveTab(TABS[idx - 1])
  }

  const toggleBuyer = (id: string) => {
    setSelectedBuyers((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    )
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await PropertyService.updateProperty(id, {
        address: form.address,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        price: form.price ? Number(form.price) : null,
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
        short_slug: form.short_slug || null,
        latitude: coords.lat,
        longitude: coords.lng,
      })
      for (const buyerId of selectedBuyers) {
        try {
          await PropertyService.addBuyerToProperty(id, buyerId)
        } catch (err) {
          console.error("Error linking buyer to property:", err)
        }
      }
      toast.success("Property updated")
      queryClient.invalidateQueries({ queryKey: ["properties"] })
      router.push(`/properties/${id}`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to update property")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-4">Loading...</div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-4 max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">Edit Property</h1>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <Home className="h-4 w-4" /> Basic Details
            </TabsTrigger>
            <TabsTrigger value="dispo" className="flex items-center gap-2">
              <Info className="h-4 w-4" /> Disposition Info
            </TabsTrigger>
            <TabsTrigger value="media" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Media
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <AddressAutocomplete
                    value={{ address: form.address, city: form.city, state: form.state, zip: form.zip }}
                    onSelect={(val) => {
                      handleChange("address", val.address)
                      handleChange("city", val.city)
                      handleChange("state", val.state)
                      handleChange("zip", val.zip)
                      setCoords({ lat: val.latitude, lng: val.longitude })
                    }}
                  />
                </div>
              </div>
              {MAPBOX_TOKEN && (
                <MapPreview
                  latitude={coords.lat}
                  longitude={coords.lng}
                  className="mt-6 md:mt-0"
                />
              )}
            </div>
            <div>
              <Label htmlFor="property_type">Property Type</Label>
              <Select value={form.property_type} onValueChange={(v) => handleChange("property_type", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input id="bedrooms" type="number" value={form.bedrooms} onChange={(e) => handleChange("bedrooms", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input id="bathrooms" type="number" value={form.bathrooms} onChange={(e) => handleChange("bathrooms", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="sqft">Square Feet</Label>
                <Input id="sqft" type="number" value={form.sqft} onChange={(e) => handleChange("sqft", e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dispo" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="price">Asking Price</Label>
              <Input id="price" type="number" value={form.price} onChange={(e) => handleChange("price", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="condition">Condition</Label>
              <Select value={form.condition} onValueChange={(v) => handleChange("condition", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="disposition_strategy">Disposition Strategy</Label>
                <Select value={form.disposition_strategy} onValueChange={(v) => handleChange("disposition_strategy", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGIES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="buyer_fit">Buyer Fit</Label>
                <Select value={form.buyer_fit} onValueChange={(v) => handleChange("buyer_fit", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select buyer fit" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUYER_FITS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="occupancy">Occupancy</Label>
                <Select value={form.occupancy} onValueChange={(v) => handleChange("occupancy", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select occupancy" />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCUPANCIES.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="priority">Marketing Priority</Label>
              <Select value={form.priority} onValueChange={(v) => handleChange("priority", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1">Tags</Label>
              <TagSelector value={form.tags} onChange={(v) => handleChange("tags", v)} allowCreate={true} />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1">Matched Buyers ({matchedBuyers.length})</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {matchedBuyers.length === 0 && (
                  <p className="text-sm text-muted-foreground">No buyers found</p>
                )}
                {matchedBuyers.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedBuyers.includes(b.id)}
                      onCheckedChange={() => toggleBuyer(b.id)}
                    />
                    <span>{b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed"}</span>
                  </label>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="media" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="photos">Photos</Label>
              <Input id="photos" type="file" multiple onChange={(e) => setPhotos(e.target.files)} />
            </div>
            <div>
              <Label htmlFor="video_link">Video Link</Label>
              <Input id="video_link" value={form.video_link} onChange={(e) => handleChange("video_link", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="website_url">Website URL</Label>
              <Input id="website_url" value={form.website_url} onChange={(e) => handleChange("website_url", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="short_slug">Short Link Slug</Label>
              <Input id="short_slug" value={form.short_slug} onChange={(e) => handleChange("short_slug", e.target.value)} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between mt-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push(`/properties/${id}`)}>Cancel</Button>
            {activeTab !== "basic" && (
              <Button variant="outline" onClick={handlePrev} disabled={loading}>
                Previous
              </Button>
            )}
          </div>
          <div>
            {activeTab !== "media" ? (
              <Button onClick={handleNext} disabled={loading}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Property"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
