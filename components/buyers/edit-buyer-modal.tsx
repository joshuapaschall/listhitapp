"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from "@/lib/supabase"
import type { Buyer, Property, OfferWithRelations } from "@/lib/supabase"
import { normalizePhone, formatPhoneDisplay } from "@/lib/dedup-utils"
import { createLogger } from "@/lib/logger"
import TagSelector from "./tag-selector"
import GroupTreeSelector from "./group-tree-selector"
import {
  getBuyerGroups,
  addBuyersToGroups,
  removeBuyersFromGroups,
} from "@/lib/group-service"
import { PROPERTY_TYPES } from "@/lib/constant"
import LocationSelector from "./location-selector"
import PropertySelector from "./property-selector"
import { PropertyService } from "@/services/property-service"
import ScheduleShowingModal from "@/components/showings/schedule-showing-modal"
import { ShowingService } from "@/services/showing-service"
import { OfferService } from "@/services/offer-service"
import OfferCard from "@/components/offers/offer-card"
import OfferDetailDrawer from "@/components/offers/offer-detail-drawer"
import CreateOfferModal from "@/components/offers/CreateOfferModal"
import SendEmailModal from "@/components/buyers/send-email-modal"
import SendSmsModal from "@/components/buyers/send-sms-modal"
import { CallButton } from "@/components/voice/CallButton"
import { BuyerService } from "@/services/buyer-service"
import { toast } from "sonner"
import {
  User,
  MapPin,
  FileText,
  Calendar,
  MessageSquare,
  DollarSign,
  Phone,
  Mail,
  Home,
  Star,
  CheckCircle,
  Plus,
} from "lucide-react"

interface EditBuyerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  buyer: Buyer | null
  onSuccess: () => void
}
const log = createLogger("edit-buyer-modal")

const SOURCES = [
  "Website",
  "Referral",
  "Social Media",
  "Direct Mail",
  "Cold Call",
  "Email Campaign",
  "Event/Networking",
  "Advertisement",
  "Other",
]

// Small presentational helpers for the Communications timeline.
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const fmtDuration = (sec: number | null) => {
  if (!sec || sec <= 0) return ""
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
const relTime = (ts: string | null) => {
  if (!ts) return ""
  const d = new Date(ts)
  return isNaN(d.getTime()) ? "" : formatDistanceToNow(d, { addSuffix: true })
}

export default function EditBuyerModal({ open, onOpenChange, buyer, onSuccess }: EditBuyerModalProps) {
  const [loading, setLoading] = useState(false)
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [originalGroupIds, setOriginalGroupIds] = useState<string[]>([])
  const [property, setProperty] = useState<Property | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showCreateOfferModal, setShowCreateOfferModal] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<OfferWithRelations | null>(null)
  const [offerDrawerOpen, setOfferDrawerOpen] = useState(false)
  const { data: showings = [], refetch: refetchShowings } = useQuery({
    queryKey: ["buyer-showings", buyer?.id],
    queryFn: () => ShowingService.getShowings({ buyerId: buyer!.id }),
    enabled: !!buyer && open,
  })
  const { data: offers = [], refetch: refetchOffers } = useQuery({
    queryKey: ["buyer-offers", buyer?.id],
    queryFn: () => OfferService.getOffers({ buyerId: buyer!.id }),
    // Mirror the showings query: only fetch when the modal is open and a buyer
    // exists. (Guards against the query firing for modals mounted-but-closed,
    // e.g. inside the inbox conversation pane.)
    enabled: !!buyer?.id && open,
  })
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showSmsModal, setShowSmsModal] = useState(false)
  const { data: buyerMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["buyer-messages", buyer?.id],
    queryFn: async () => {
      const res = await fetch(`/api/buyers/${buyer!.id}/messages`)
      const json = await res.json().catch(() => ({}))
      return (json?.messages ?? []) as any[]
    },
    enabled: !!buyer?.id && open,
  })
  const { data: buyerCalls = [], isLoading: callsLoading } = useQuery({
    queryKey: ["buyer-calls", buyer?.id],
    queryFn: async () => {
      const res = await fetch(`/api/calls/history?buyerId=${buyer!.id}&pageSize=50`)
      const json = await res.json().catch(() => ({}))
      return (json?.calls ?? []) as any[]
    },
    enabled: !!buyer?.id && open,
  })
  const commsLoading = messagesLoading || callsLoading
  const commsTimeline = useMemo(() => {
    const sms = (buyerMessages || []).map((m: any) => ({
      id: `sms-${m.id}`,
      type: "sms" as const,
      ts: m.created_at as string | null,
      direction: (m.direction as string) || "",
      body: (m.body as string) || "",
      status: (m.status as string) || "",
      duration: null as number | null,
    }))
    const calls = (buyerCalls || []).map((c: any) => ({
      id: `call-${c.id}`,
      type: "call" as const,
      ts: c.started_at as string | null,
      direction: (c.direction as string) || "",
      body: "",
      status: (c.status as string) || "",
      duration: (c.duration_seconds as number | null) ?? null,
    }))
    return [...sms, ...calls].sort(
      (a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime(),
    )
  }, [buyerMessages, buyerCalls])
  const [formData, setFormData] = useState({
    // Contact Info
    fname: "",
    lname: "",
    full_name: "",
    email: "",
    phone: "",
    phone2: "",
    phone3: "",
    company: "",
    mailing_address: "",
    mailing_city: "",
    mailing_state: "",
    mailing_zip: "",

    // Location & Property
    locations: [] as string[],
    property_type: [] as string[],

    // Preferences - matching Add Buyer modal exactly
    asking_price_min: "",
    asking_price_max: "",
    year_built_min: "",
    year_built_max: "",
    sqft_min: "",
    sqft_max: "",
    beds_min: "",
    baths_min: "",

    // Investment Criteria - matching Add Buyer modal exactly
    min_arv: "",
    min_arv_percent: "",
    min_gross_margin: "",
    max_gross_margin: "",

    // Owner Finance / Rent to Own / Land Contract - matching Add Buyer modal exactly
    down_payment_min: "",
    down_payment_max: "",
    monthly_payment_min: "",
    monthly_payment_max: "",

    // Status & Notes
    status: "lead",
    score: 50,
    vip: false,
    vetted: false,
    can_receive_email: true,
    can_receive_sms: true,
    source: "",
    notes: "",
    tags: [] as string[],
  })

  // Populate form when buyer changes
  useEffect(() => {
    if (buyer) {
      setFormData({
        fname: buyer.fname || "",
        lname: buyer.lname || "",
        full_name: buyer.full_name || "",
        email: buyer.email || "",
        phone: buyer.phone ? formatPhoneDisplay(buyer.phone) : "",
        phone2: buyer.phone2 ? formatPhoneDisplay(buyer.phone2) : "",
        phone3: buyer.phone3 ? formatPhoneDisplay(buyer.phone3) : "",
        company: buyer.company || "",
        mailing_address: buyer.mailing_address || "",
        mailing_city: buyer.mailing_city || "",
        mailing_state: buyer.mailing_state || "",
        mailing_zip: buyer.mailing_zip || "",
        locations: buyer.locations || [],
        property_type: buyer.property_type || [],
        asking_price_min: buyer.asking_price_min?.toString() || "",
        asking_price_max: buyer.asking_price_max?.toString() || "",
        year_built_min: buyer.year_built_min?.toString() || "",
        year_built_max: buyer.year_built_max?.toString() || "",
        sqft_min: buyer.sqft_min?.toString() || "",
        sqft_max: buyer.sqft_max?.toString() || "",
        beds_min: buyer.beds_min?.toString() || "",
        baths_min: buyer.baths_min?.toString() || "",
        min_arv: buyer.min_arv?.toString() || "",
        min_arv_percent: buyer.min_arv_percent?.toString() || "",
        min_gross_margin: buyer.min_gross_margin?.toString() || "",
        max_gross_margin: buyer.max_gross_margin?.toString() || "",
        down_payment_min: buyer.down_payment_min?.toString() || "",
        down_payment_max: buyer.down_payment_max?.toString() || "",
        monthly_payment_min: buyer.monthly_payment_min?.toString() || "",
        monthly_payment_max: buyer.monthly_payment_max?.toString() || "",
        status: buyer.status || "lead",
        score: buyer.score || 50,
        vip: buyer.vip || false,
        vetted: buyer.vetted || false,
        can_receive_email: buyer.can_receive_email ?? true,
        can_receive_sms: buyer.can_receive_sms ?? true,
        source: buyer.source || "",
        notes: buyer.notes || "",
        tags: buyer.tags || [],
      })
      if (buyer.property_interest) {
        PropertyService.getProperty(buyer.property_interest).then((p) =>
          setProperty(p),
        )
      } else {
        setProperty(null)
      }
    }
  }, [buyer])

  // Load buyer groups when modal opens
  useEffect(() => {
    if (!buyer || !open) return
    const loadGroups = async () => {
      const groups = await getBuyerGroups(buyer.id)
      setGroupIds(groups)
      setOriginalGroupIds(groups)
    }
    loadGroups()
  }, [buyer, open])

  useEffect(() => {
    if (!open) {
      setProperty(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!buyer) return

    setLoading(true)
    try {
      const { full_name: _unused, ...restFormData } = formData
      const updateData: Record<string, any> = {
        ...restFormData,
        asking_price_min: formData.asking_price_min ? Number.parseFloat(formData.asking_price_min) : null,
        asking_price_max: formData.asking_price_max ? Number.parseFloat(formData.asking_price_max) : null,
        year_built_min: formData.year_built_min ? Number.parseInt(formData.year_built_min) : null,
        year_built_max: formData.year_built_max ? Number.parseInt(formData.year_built_max) : null,
        sqft_min: formData.sqft_min ? Number.parseInt(formData.sqft_min) : null,
        sqft_max: formData.sqft_max ? Number.parseInt(formData.sqft_max) : null,
        beds_min: formData.beds_min ? Number.parseInt(formData.beds_min) : null,
        baths_min: formData.baths_min ? Number.parseFloat(formData.baths_min) : null,
        min_arv: formData.min_arv ? Number.parseInt(formData.min_arv) : null,
        min_arv_percent: formData.min_arv_percent ? Number.parseFloat(formData.min_arv_percent) : null,
        min_gross_margin: formData.min_gross_margin ? Number.parseInt(formData.min_gross_margin) : null,
        max_gross_margin: formData.max_gross_margin ? Number.parseInt(formData.max_gross_margin) : null,
        down_payment_min: formData.down_payment_min ? Number.parseFloat(formData.down_payment_min) : null,
        down_payment_max: formData.down_payment_max ? Number.parseFloat(formData.down_payment_max) : null,
        monthly_payment_min: formData.monthly_payment_min ? Number.parseFloat(formData.monthly_payment_min) : null,
        monthly_payment_max: formData.monthly_payment_max ? Number.parseFloat(formData.monthly_payment_max) : null,
        tags: Array.from(new Set(formData.tags.map((t) => t.trim()))),
        property_interest: property ? property.id : null,
        updated_at: new Date().toISOString(),
      }

      // Canonicalize phones to 10-digit national before saving (phone_norm is a
      // generated column; display formatting happens via formatPhoneDisplay).
      updateData.phone = normalizePhone(formData.phone) || null
      updateData.phone2 = normalizePhone(formData.phone2) || null
      updateData.phone3 = normalizePhone(formData.phone3) || null

      log("update", "Updating buyer with data:", updateData)
      const response = await fetch(`/api/buyers/${buyer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })

      if (response.status === 403) {
        toast.error("You don't have permission to add or edit buyers.")
        return
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result?.error || "Failed to update buyer")
      }

      const groupsToAdd = groupIds.filter((id) => !originalGroupIds.includes(id))
      const groupsToRemove = originalGroupIds.filter((id) => !groupIds.includes(id))

      if (groupsToAdd.length) await addBuyersToGroups([buyer.id], groupsToAdd)
      if (groupsToRemove.length) await removeBuyersFromGroups([buyer.id], groupsToRemove)

      if (property) {
        try {
          await PropertyService.addBuyerToProperty(property.id, buyer.id)
        } catch (err) {
          log("error", "Failed to link buyer to property", { error: err })
        }
      }

      onSuccess()
      toast.success("Buyer updated")
      onOpenChange(false)
    } catch (error) {
      log("error", "Failed to update buyer", { error })
      toast.error("Failed to update buyer. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    if (!buyer) return
    try {
      await BuyerService.unsubscribeBuyer(buyer.id)
      updateFormData("can_receive_email", false)
      updateFormData("can_receive_sms", false)
      toast.success("Buyer unsubscribed")
      onSuccess()
    } catch (err) {
      log("error", "Failed to unsubscribe buyer", { error: err })
      toast.error("Failed to unsubscribe")
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  if (!buyer) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-full p-0 gap-0 overflow-hidden flex flex-col h-[min(680px,90vh)]">
        <DialogHeader className="shrink-0 px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-base font-semibold tracking-tight">
            Edit buyer: {buyer.fname} {buyer.lname}
          </DialogTitle>
        </DialogHeader>

        {(() => {
          const stripName = formData.full_name || `${formData.fname} ${formData.lname}`.trim() || "Unnamed"
          const stripInitials = stripName.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
          return (
            <div className="flex shrink-0 items-center gap-3 border-b bg-muted/40 px-6 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback>{stripInitials || "—"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{stripName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {formData.email || "No email"} · {formData.phone || "No phone"}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="secondary" className="text-xs text-muted-foreground">Score {formData.score}</Badge>
                {formData.status ? (
                  <Badge variant="outline" className="text-xs capitalize">{formData.status}</Badge>
                ) : null}
              </div>
            </div>
          )
        })()}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <Tabs defaultValue="contact" className="flex flex-col flex-1 min-h-0">
            <TabsList className="inline-flex w-full gap-1 rounded-lg bg-muted p-1 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 mx-6 mt-3">
              <TabsTrigger value="contact" className="text-xs shrink-0 rounded-md text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:ring-1 focus-visible:ring-[hsl(var(--brand-ring))] focus-visible:ring-offset-0">
                Contact
              </TabsTrigger>
              <TabsTrigger value="location" className="text-xs shrink-0 rounded-md text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:ring-1 focus-visible:ring-[hsl(var(--brand-ring))] focus-visible:ring-offset-0">
                Location
              </TabsTrigger>
              <TabsTrigger value="preferences" className="text-xs shrink-0 rounded-md text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:ring-1 focus-visible:ring-[hsl(var(--brand-ring))] focus-visible:ring-offset-0">
                Preferences
              </TabsTrigger>
              <TabsTrigger value="status" className="text-xs shrink-0 rounded-md text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:ring-1 focus-visible:ring-[hsl(var(--brand-ring))] focus-visible:ring-offset-0">
                Status
              </TabsTrigger>
              <TabsTrigger value="showings" className="text-xs shrink-0 rounded-md text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:ring-1 focus-visible:ring-[hsl(var(--brand-ring))] focus-visible:ring-offset-0">
                Showings
              </TabsTrigger>
              <TabsTrigger value="offers" className="text-xs shrink-0 rounded-md text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:ring-1 focus-visible:ring-[hsl(var(--brand-ring))] focus-visible:ring-offset-0">
                Offers
              </TabsTrigger>
              <TabsTrigger value="communications" className="text-xs shrink-0 rounded-md text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:ring-1 focus-visible:ring-[hsl(var(--brand-ring))] focus-visible:ring-offset-0">
                Communications
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            {/* Contact Tab */}
            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <User className="h-5 w-5 text-brand" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fname">First Name</Label>
                    <Input
                      id="fname"
                      value={formData.fname}
                      onChange={(e) => updateFormData("fname", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lname">Last Name</Label>
                    <Input
                      id="lname"
                      value={formData.lname}
                      onChange={(e) => updateFormData("lname", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="full_name">Full Name (Display)</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => updateFormData("full_name", e.target.value)}
                      placeholder="Leave blank to auto-generate"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => updateFormData("company", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <Phone className="h-5 w-5 text-brand" />
                    Contact Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Primary Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => updateFormData("phone", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone2">Secondary Phone</Label>
                    <Input
                      id="phone2"
                      value={formData.phone2}
                      onChange={(e) => updateFormData("phone2", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone3">Additional Phone</Label>
                    <Input
                      id="phone3"
                      value={formData.phone3}
                      onChange={(e) => updateFormData("phone3", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <MapPin className="h-5 w-5 text-brand" />
                    Mailing Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="mailing_address">Street Address</Label>
                    <Input
                      id="mailing_address"
                      value={formData.mailing_address}
                      onChange={(e) => updateFormData("mailing_address", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="mailing_city">City</Label>
                      <Input
                        id="mailing_city"
                        value={formData.mailing_city}
                        onChange={(e) => updateFormData("mailing_city", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="mailing_state">State</Label>
                      <Input
                        id="mailing_state"
                        value={formData.mailing_state}
                        onChange={(e) => updateFormData("mailing_state", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="mailing_zip">ZIP Code</Label>
                      <Input
                        id="mailing_zip"
                        value={formData.mailing_zip}
                        onChange={(e) => updateFormData("mailing_zip", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Location Tab */}
            <TabsContent value="location" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <MapPin className="h-5 w-5 text-brand" />
                    Target Locations
                  </CardTitle>
                  <CardDescription>
                    Select the areas where this buyer is interested in purchasing property
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LocationSelector value={formData.locations}
                    onChange={(locations) => updateFormData("locations", locations)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <Home className="h-5 w-5 text-brand" />
                    Property Interest
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <PropertySelector value={property} onChange={setProperty} />
                  {/* Removed duplicate Property Types section from here */}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preferences Tab - Matching Add Buyer Modal Exactly */}
            <TabsContent value="preferences" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <Home className="h-5 w-5 text-brand" />
                    Property Types
                  </CardTitle>
                  <CardDescription>What types of properties are they interested in?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {PROPERTY_TYPES.sort().map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`pref-property-${type}`}
                          checked={formData.property_type.includes(type)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updateFormData("property_type", [...formData.property_type, type])
                            } else {
                              updateFormData(
                                "property_type",
                                formData.property_type.filter((t) => t !== type),
                              )
                            }
                          }}
                        />
                        <Label htmlFor={`pref-property-${type}`} className="text-sm">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <DollarSign className="h-5 w-5 text-brand" />
                    Price Range
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="asking_price_min">Minimum Price ($)</Label>
                    <Input
                      id="asking_price_min"
                      type="number"
                      value={formData.asking_price_min}
                      onChange={(e) => updateFormData("asking_price_min", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="asking_price_max">Maximum Price ($)</Label>
                    <Input
                      id="asking_price_max"
                      type="number"
                      value={formData.asking_price_max}
                      onChange={(e) => updateFormData("asking_price_max", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <Home className="h-5 w-5 text-brand" />
                    Property Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="year_built_min">Minimum Year Built</Label>
                    <Input
                      id="year_built_min"
                      type="number"
                      value={formData.year_built_min}
                      onChange={(e) => updateFormData("year_built_min", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="year_built_max">Maximum Year Built</Label>
                    <Input
                      id="year_built_max"
                      type="number"
                      value={formData.year_built_max}
                      onChange={(e) => updateFormData("year_built_max", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sqft_min">Minimum Square Feet</Label>
                    <Input
                      id="sqft_min"
                      type="number"
                      value={formData.sqft_min}
                      onChange={(e) => updateFormData("sqft_min", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sqft_max">Maximum Square Feet</Label>
                    <Input
                      id="sqft_max"
                      type="number"
                      value={formData.sqft_max}
                      onChange={(e) => updateFormData("sqft_max", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="beds_min">Minimum Bedrooms</Label>
                    <Input
                      id="beds_min"
                      type="number"
                      value={formData.beds_min}
                      onChange={(e) => updateFormData("beds_min", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="baths_min">Minimum Bathrooms</Label>
                    <Input
                      id="baths_min"
                      type="number"
                      step="0.5"
                      value={formData.baths_min}
                      onChange={(e) => updateFormData("baths_min", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <DollarSign className="h-5 w-5 text-brand" />
                    Investment Criteria
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minimum_arv">Minimum ARV ($)</Label>
                    <Input
                      id="minimum_arv"
                      type="number"
                      value={formData.min_arv}
                      onChange={(e) => updateFormData("min_arv", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="min_arv_percent">Minimum ARV Percentage (%)</Label>
                    <Input
                      id="min_arv_percent"
                      type="number"
                      step="0.1"
                      value={formData.min_arv_percent}
                      onChange={(e) => updateFormData("min_arv_percent", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="minimum_gross_margin">Minimum Gross Margin ($)</Label>
                    <Input
                      id="minimum_gross_margin"
                      type="number"
                      value={formData.min_gross_margin}
                      onChange={(e) => updateFormData("min_gross_margin", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maximum_gross_margin">Maximum Gross Margin ($)</Label>
                    <Input
                      id="maximum_gross_margin"
                      type="number"
                      value={formData.max_gross_margin}
                      onChange={(e) => updateFormData("max_gross_margin", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <DollarSign className="h-5 w-5 text-brand" />
                    Owner Finance / Rent to Own / Land Contract
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="down_payment_min">Minimum Down Payment ($)</Label>
                    <Input
                      id="down_payment_min"
                      type="number"
                      value={formData.down_payment_min}
                      onChange={(e) => updateFormData("down_payment_min", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="down_payment_max">Maximum Down Payment ($)</Label>
                    <Input
                      id="down_payment_max"
                      type="number"
                      value={formData.down_payment_max}
                      onChange={(e) => updateFormData("down_payment_max", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="monthly_payment_min">Minimum Monthly Payment ($)</Label>
                    <Input
                      id="monthly_payment_min"
                      type="number"
                      value={formData.monthly_payment_min}
                      onChange={(e) => updateFormData("monthly_payment_min", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="monthly_payment_max">Maximum Monthly Payment ($)</Label>
                    <Input
                      id="monthly_payment_max"
                      type="number"
                      value={formData.monthly_payment_max}
                      onChange={(e) => updateFormData("monthly_payment_max", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Status Tab */}
            <TabsContent value="status" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <FileText className="h-5 w-5 text-brand" />
                    Buyer Status & Classification
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value: any) => updateFormData("status", value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="under_contract">Under Contract</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="score">Buyer Score (0-100)</Label>
                      <Input
                        id="score"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.score}
                        onChange={(e) => updateFormData("score", Number.parseInt(e.target.value))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="source">How did they hear about us?</Label>
                      <Select value={formData.source} onValueChange={(value) => updateFormData("source", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCES.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="vip"
                        checked={formData.vip}
                        onCheckedChange={(checked) => updateFormData("vip", checked)}
                      />
                      <Label htmlFor="vip" className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        VIP Client
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="vetted"
                        checked={formData.vetted}
                        onCheckedChange={(checked) => updateFormData("vetted", checked)}
                      />
                      <Label htmlFor="vetted" className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Vetted Buyer
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="can_receive_email"
                        checked={formData.can_receive_email}
                        onCheckedChange={(checked) => updateFormData("can_receive_email", checked)}
                      />
                      <Label htmlFor="can_receive_email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-blue-500" />
                        Can Receive Email
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="can_receive_sms"
                        checked={formData.can_receive_sms}
                        onCheckedChange={(checked) => updateFormData("can_receive_sms", checked)}
                      />
                      <Label htmlFor="can_receive_sms" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-purple-500" />
                        Can Receive SMS
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <FileText className="h-5 w-5 text-brand" />
                    Tags & Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Tags</Label>
                    <TagSelector value={formData.tags} onChange={(tags) => updateFormData("tags", tags)} />
                  </div>

                  <div>
                    <Label>Groups</Label>
                    <GroupTreeSelector value={groupIds} onChange={setGroupIds} />
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => updateFormData("notes", e.target.value)}
                      rows={4}
                      placeholder="Add any additional notes about this buyer..."
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Showings Tab */}
            <TabsContent value="showings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <Calendar className="h-5 w-5 text-brand" />
                    Property Showings
                  </CardTitle>
                  <CardDescription>Track property showings and viewing history</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={() => setShowScheduleModal(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Schedule Showing
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {showings.map((showing: any) => (
                      <Card key={showing.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold">{showing.properties?.address ?? "-"}</h4>
                              <p className="text-sm text-muted-foreground">{new Date(showing.scheduled_at).toLocaleString()}</p>
                              {showing.notes && <p className="text-sm mt-1">{showing.notes}</p>}
                            </div>
                            <Badge variant={showing.status === "scheduled" ? "default" : "secondary"}>
                              {showing.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {showings.length === 0 && (
                      <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <Calendar className="h-8 w-8 opacity-50" />
                        No showings scheduled yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Offers Tab */}
            <TabsContent value="offers" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <DollarSign className="h-5 w-5 text-brand" />
                    Offers & Negotiations
                  </CardTitle>
                  <CardDescription>Track offers made and received</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={() => setShowCreateOfferModal(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      New Offer
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {offers.map((offer) => (
                      <OfferCard
                        key={offer.id}
                        offer={offer}
                        draggable={false}
                        onClick={(o) => {
                          setSelectedOffer(o)
                          setOfferDrawerOpen(true)
                        }}
                      />
                    ))}

                    {offers.length === 0 && (
                      <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <DollarSign className="h-8 w-8 opacity-50" />
                        No offers yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Communications Tab */}
            <TabsContent value="communications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
                    <MessageSquare className="h-5 w-5 text-brand" />
                    Communication History
                  </CardTitle>
                  <CardDescription>Track all communications with this buyer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button type="button" variant="destructive" onClick={handleUnsubscribe}>
                    Unsubscribe from All
                  </Button>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowEmailModal(true)}>
                      <Mail className="h-4 w-4 mr-1.5" /> Send Email
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowSmsModal(true)}>
                      <MessageSquare className="h-4 w-4 mr-1.5" /> Send SMS
                    </Button>
                    <CallButton
                      phone={buyer?.phone}
                      name={buyer?.full_name || `${buyer?.fname ?? ""} ${buyer?.lname ?? ""}`.trim()}
                      buyerId={buyer?.id}
                    />
                  </div>
                  {commsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : commsTimeline.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No communications yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {commsTimeline.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
                        >
                          {item.type === "sms" ? (
                            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {item.type === "sms"
                              ? `${cap(item.direction) || "Message"}${item.body ? ` · ${item.body.slice(0, 80)}` : ""}`
                              : `${cap(item.direction) || "Call"}${item.status ? ` · ${cap(item.status)}` : ""}${
                                  fmtDuration(item.duration) ? ` · ${fmtDuration(item.duration)}` : ""
                                }`}
                          </p>
                          <span className="shrink-0 text-xs text-muted-foreground">{relTime(item.ts)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            </div>
          </Tabs>

          <div className="shrink-0 border-t px-6 py-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {loading ? "Updating..." : "Update Buyer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <ScheduleShowingModal
      open={showScheduleModal}
      onOpenChange={setShowScheduleModal}
      buyer={buyer}
      onSuccess={refetchShowings}
    />
    <CreateOfferModal
      open={showCreateOfferModal}
      onOpenChange={setShowCreateOfferModal}
      buyer={buyer}
      onSuccess={() => {
        setShowCreateOfferModal(false)
        refetchOffers()
      }}
    />
    <OfferDetailDrawer
      open={offerDrawerOpen}
      onOpenChange={setOfferDrawerOpen}
      offer={selectedOffer}
      onSuccess={refetchOffers}
      canManage
    />
    <SendEmailModal open={showEmailModal} onOpenChange={setShowEmailModal} buyer={buyer} />
    <SendSmsModal open={showSmsModal} onOpenChange={setShowSmsModal} buyer={buyer} />
    </>
  )
}
