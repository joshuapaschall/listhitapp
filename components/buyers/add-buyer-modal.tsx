"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, User, MapPin, Home, Star, AlertCircle, ChevronRight, ChevronLeft } from "lucide-react"
import { supabase, type Buyer, type Property } from "@/lib/supabase"
import { normalizeEmail, normalizePhone, mergeUnique } from "@/lib/dedup-utils"
import { toast } from "sonner"
import TagSelector from "./tag-selector"
import { PROPERTY_TYPES } from "@/lib/constant"
import LocationSelector from "./location-selector"
import GroupTreeSelector from "./group-tree-selector"
import { addBuyersToGroups } from "@/lib/group-service"
import PropertySelector from "./property-selector"
import { PropertyService } from "@/services/property-service"
import ScheduleShowingModal from "@/components/showings/schedule-showing-modal"

interface AddBuyerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccessAction?: (buyer: Buyer) => void
  onEditBuyer?: (buyer: Buyer) => void
  initialPhone?: string
}

interface BuyerFormData {
  // Contact Info
  fname: string
  lname: string
  phone: string
  email: string
  company: string
  mailing_address: string
  mailing_city: string
  mailing_state: string
  mailing_zip: string
  website: string
  score: number
  tags: string[]
  source: string

  // Location Settings
  locations: string[]

  // Preferences
  property_type: string[]
  asking_price_min: string
  asking_price_max: string
  year_built_min: string
  year_built_max: string
  sqft_min: string
  sqft_max: string
  beds_min: string
  baths_min: string
  min_arv: string
  min_arv_percent: string
  min_gross_margin: string
  max_gross_margin: string

  // Owner Finance / Rent to Own / Land Contract (moved to preferences)
  down_payment_min: string
  down_payment_max: string
  monthly_payment_min: string
  monthly_payment_max: string

  // Status & Notes
  status: string
  vip: boolean
  vetted: boolean
  can_receive_sms: boolean
  can_receive_email: boolean
  notes: string
}

const initialFormData: BuyerFormData = {
  // Contact Info
  fname: "",
  lname: "",
  phone: "",
  email: "",
  company: "",
  mailing_address: "",
  mailing_city: "",
  mailing_state: "",
  mailing_zip: "",
  website: "",
  score: 50,
  tags: [],
  source: "",

  // Location Settings
  locations: [],

  // Preferences
  property_type: [],
  asking_price_min: "",
  asking_price_max: "",
  year_built_min: "",
  year_built_max: "",
  sqft_min: "",
  sqft_max: "",
  beds_min: "",
  baths_min: "",
  min_arv: "",
  min_arv_percent: "",
  min_gross_margin: "",
  max_gross_margin: "",

  // Owner Finance / Rent to Own / Land Contract
  down_payment_min: "",
  down_payment_max: "",
  monthly_payment_min: "",
  monthly_payment_max: "",

  // Status & Notes
  status: "lead",
  vip: false,
  vetted: false,
  can_receive_sms: true,
  can_receive_email: true,
  notes: "",
}


const SOURCES = ["Website", "Referral", "Social Media", "Cold Call", "Email Campaign", "Event", "Walk-in", "Other"]

const STATUSES = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "active", label: "Active" },
  { value: "under_contract", label: "Under Contract" },
  { value: "closed", label: "Closed" },
  { value: "inactive", label: "Inactive" },
]

const TABS = ["contact", "location", "preferences", "status"]

export default function AddBuyerModal({ open, onOpenChange, onSuccessAction, onEditBuyer, initialPhone }: AddBuyerModalProps) {
  const [formData, setFormData] = useState<BuyerFormData>(initialFormData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("contact")
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [duplicateBuyer, setDuplicateBuyer] = useState<any | null>(null)
  const [property, setProperty] = useState<Property | null>(null)
  const [scheduleProperty, setScheduleProperty] = useState<Property | null>(null)
  const [scheduleShowing, setScheduleShowing] = useState(false)
  const [createdBuyerId, setCreatedBuyerId] = useState<string | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (open && initialPhone) {
      setFormData((prev) => ({ ...prev, phone: initialPhone }))
    }
  }, [open, initialPhone])


  const handleInputChange = <K extends keyof BuyerFormData>(
    field: K,
    value: BuyerFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePropertyTypeToggle = (type: string) => {
    const current = formData.property_type
    if (current.includes(type)) {
      handleInputChange(
        "property_type",
        current.filter((t) => t !== type),
      )
    } else {
      handleInputChange("property_type", [...current, type])
    }
  }

  const validateForm = () => {
    if (!formData.fname && !formData.lname) {
      return "Please provide at least a first or last name"
    }
    if (!formData.email && !formData.phone) {
      return "Please provide either an email address or phone number"
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      return "Please provide a valid email address"
    }
    return null
  }

  const handleNext = () => {
    const currentIndex = TABS.indexOf(activeTab)
    if (currentIndex < TABS.length - 1) {
      setActiveTab(TABS[currentIndex + 1])
    }
  }

  const handlePrevious = () => {
    const currentIndex = TABS.indexOf(activeTab)
    if (currentIndex > 0) {
      setActiveTab(TABS[currentIndex - 1])
    }
  }

  const handleSubmit = async (bypassCheck = false) => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError("")

    try {
      // Prepare data for insertion
      const emailNorm = normalizeEmail(formData.email)
      const phoneNorm = normalizePhone(formData.phone)

      const insertData = {
        fname: formData.fname || null,
        lname: formData.lname || null,
        email: emailNorm,
        phone: phoneNorm,
        company: formData.company || null,
        mailing_address: formData.mailing_address || null,
        mailing_city: formData.mailing_city || null,
        mailing_state: formData.mailing_state || null,
        mailing_zip: formData.mailing_zip || null,
        website: formData.website || null,
        score: formData.score,
        tags: formData.tags,
        source: formData.source || null,
        locations: formData.locations.length > 0 ? formData.locations : null,
        property_type: formData.property_type.length > 0 ? formData.property_type : null,
        asking_price_min: formData.asking_price_min ? Number.parseFloat(formData.asking_price_min) : null,
        asking_price_max: formData.asking_price_max ? Number.parseFloat(formData.asking_price_max) : null,
        year_built_min: formData.year_built_min ? Number.parseInt(formData.year_built_min) : null,
        year_built_max: formData.year_built_max ? Number.parseInt(formData.year_built_max) : null,
        sqft_min: formData.sqft_min ? Number.parseInt(formData.sqft_min) : null,
        sqft_max: formData.sqft_max ? Number.parseInt(formData.sqft_max) : null,
        beds_min: formData.beds_min ? Number.parseInt(formData.beds_min) : null,
        baths_min: formData.baths_min ? Number.parseInt(formData.baths_min) : null,
        min_arv: formData.min_arv ? Number.parseFloat(formData.min_arv) : null,
        min_arv_percent: formData.min_arv_percent ? Number.parseFloat(formData.min_arv_percent) : null,
        min_gross_margin: formData.min_gross_margin ? Number.parseFloat(formData.min_gross_margin) : null,
        max_gross_margin: formData.max_gross_margin ? Number.parseFloat(formData.max_gross_margin) : null,
        down_payment_min: formData.down_payment_min ? Number.parseFloat(formData.down_payment_min) : null,
        down_payment_max: formData.down_payment_max ? Number.parseFloat(formData.down_payment_max) : null,
        monthly_payment_min: formData.monthly_payment_min ? Number.parseFloat(formData.monthly_payment_min) : null,
        monthly_payment_max: formData.monthly_payment_max ? Number.parseFloat(formData.monthly_payment_max) : null,
        status: formData.status,
        vip: formData.vip,
        vetted: formData.vetted,
        can_receive_sms: formData.can_receive_sms,
        can_receive_email: formData.can_receive_email,
        notes: formData.notes || null,
        property_interest: property ? property.id : null,
        created_at: new Date().toISOString(),
      }

      let existingBuyer: any = duplicateBuyer
      if (!bypassCheck) {
        existingBuyer = null
        if (emailNorm) {
          const { data, error } = await supabase
            .from("buyers")
            .select("*")
            .eq("email_norm", emailNorm)
            .limit(1)
          if (error) throw error
          if (data && data.length) existingBuyer = data[0]
        }

        if (!existingBuyer && phoneNorm) {
          const { data, error } = await supabase
            .from("buyers")
            .select("*")
            .eq("phone_norm", phoneNorm)
            .limit(1)
          if (error) throw error
          if (data && data.length) existingBuyer = data[0]
        }
      }

      if (existingBuyer && !bypassCheck) {
        setDuplicateBuyer(existingBuyer)
        setLoading(false)
        return
      }
      let newBuyerId: string | undefined

      if (existingBuyer) {
        const updateData: Record<string, any> = {}
        Object.entries(insertData).forEach(([key, val]) => {
          if (val !== null && val !== "" && key !== "created_at") {
            if (key === "tags") {
              updateData.tags = mergeUnique(existingBuyer.tags, val as any)
            } else if (key === "locations") {
              updateData.locations = mergeUnique(existingBuyer.locations, val as any)
            } else if (key === "property_type") {
              updateData.property_type = mergeUnique(existingBuyer.property_type, val as any)
            } else {
              updateData[key] = val
            }
          }
        })
        updateData.updated_at = new Date().toISOString()

        const { error } = await supabase
          .from("buyers")
          .update(updateData)
          .eq("id", existingBuyer.id)

        if (error) throw error

        newBuyerId = existingBuyer.id
      } else {
        const { data, error } = await supabase
          .from("buyers")
          .insert([insertData])
          .select()

        if (error) throw error

        newBuyerId = data?.[0]?.id as string | undefined
      }

      if (newBuyerId && groupIds.length) {
        await addBuyersToGroups([newBuyerId], groupIds)
      }

      if (newBuyerId && property) {
        try {
          await PropertyService.addBuyerToProperty(property.id, newBuyerId)
        } catch (err) {
          console.error("Error linking property to buyer:", err)
        }
      }

      let finalBuyerId: string | null = newBuyerId || existingBuyer?.id || null
      let sendfoxContactId: number | null = null
      const emailToSync = insertData.email || existingBuyer?.email
      if (emailToSync) {
        const lists: number[] = []
        if (process.env.SENDFOX_DEFAULT_LIST_ID) {
          lists.push(Number(process.env.SENDFOX_DEFAULT_LIST_ID))
        }
        try {
          const res = await fetch("/api/sendfox/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: emailToSync,
              first_name: insertData.fname || existingBuyer?.fname,
              lists,
            }),
          })
          const sendfoxRes = await res.json()
          sendfoxContactId = sendfoxRes?.id ?? null
        } catch (err) {
          console.error("SendFox sync error", err)
        }
      }

      if (finalBuyerId && sendfoxContactId) {
        try {
          await supabase
            .from("buyers")
            .update({ sendfox_contact_id: sendfoxContactId })
            .eq("id", finalBuyerId)
        } catch (err) {
          console.error("Failed to save SendFox contact ID", err)
        }
      }

      if (existingBuyer) {
        toast.success("Buyer updated")
      } else {
        toast.success("Buyer added")
      }

      let finalBuyer: Buyer | undefined
      if (finalBuyerId) {
        const { data } = await supabase
          .from("buyers")
          .select("id,fname,lname,full_name,can_receive_sms,status")
          .eq("id", finalBuyerId)
          .single()
        if (data) finalBuyer = data as Buyer
      }
      if (scheduleShowing && finalBuyerId) {
        setCreatedBuyerId(finalBuyerId)
        setScheduleProperty(property)
        setShowScheduleModal(true)
      }

      queryClient.invalidateQueries({ queryKey: ["buyerCountsByGroup"] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })

      // Reset form and close modal
      setFormData(initialFormData)
      setGroupIds([])
      setDuplicateBuyer(null)
      setProperty(null)
      setScheduleShowing(false)
      onOpenChange(false)
      setActiveTab("contact")

      if (onSuccessAction && finalBuyer) onSuccessAction(finalBuyer)
    } catch (err: any) {
      console.error("Error adding buyer:", err)
      const msg = err?.message?.toLowerCase().includes("duplicate key value")
        ? "A buyer with this email already exists."
        : "Failed to add buyer."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmUpdate = () => {
    handleSubmit(true)
  }

  const handleClose = () => {
    if (!loading) {
      setFormData(initialFormData)
      setGroupIds([])
      setDuplicateBuyer(null)
      setProperty(null)
      setScheduleProperty(null)
      setScheduleShowing(false)
      setCreatedBuyerId(null)
      setShowScheduleModal(false)
      setError("")
      setActiveTab("contact")
      onOpenChange(false)
    }
  }

  const handleEditExisting = () => {
    if (duplicateBuyer && onEditBuyer) {
      onEditBuyer(duplicateBuyer)
      handleClose()
    }
  }

  const isLastTab = activeTab === "status"
  const isFirstTab = activeTab === "contact"

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            Create Buyer Account
          </DialogTitle>
          <DialogDescription>Enter the buyer's information following the natural sales process flow.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contact" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Info
            </TabsTrigger>
            <TabsTrigger value="location" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Status & Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-blue-400">📇</span>
                  <strong>Contact Information</strong>
                </CardTitle>
                <CardDescription>Basic contact information and buyer details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Personal Info Section */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Personal Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fname" className="font-semibold">
                        First Name
                      </Label>
                      <Input
                        id="fname"
                        value={formData.fname}
                        onChange={(e) => handleInputChange("fname", e.target.value)}
                        placeholder="John"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lname" className="font-semibold">
                        Last Name
                      </Label>
                      <Input
                        id="lname"
                        value={formData.lname}
                        onChange={(e) => handleInputChange("lname", e.target.value)}
                        placeholder="Smith"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Details Section */}
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Contact Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone" className="font-semibold">
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        placeholder="(555) 123-4567"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="font-semibold">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="john@example.com"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Mailing Address Section */}
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Mailing Address</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="mailing_address" className="font-semibold">
                        Street Address
                      </Label>
                      <Input
                        id="mailing_address"
                        value={formData.mailing_address}
                        onChange={(e) => handleInputChange("mailing_address", e.target.value)}
                        placeholder="123 Main Street"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="mailing_city" className="font-semibold">
                          City
                        </Label>
                        <Input
                          id="mailing_city"
                          value={formData.mailing_city}
                          onChange={(e) => handleInputChange("mailing_city", e.target.value)}
                          placeholder="Atlanta"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="mailing_state" className="font-semibold">
                          State
                        </Label>
                        <Input
                          id="mailing_state"
                          value={formData.mailing_state}
                          onChange={(e) => handleInputChange("mailing_state", e.target.value)}
                          placeholder="GA"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="mailing_zip" className="font-semibold">
                          ZIP Code
                        </Label>
                        <Input
                          id="mailing_zip"
                          value={formData.mailing_zip}
                          onChange={(e) => handleInputChange("mailing_zip", e.target.value)}
                          placeholder="30309"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Business Info Section */}
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Business Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company" className="font-semibold">
                        Company Name
                      </Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) => handleInputChange("company", e.target.value)}
                        placeholder="ABC Investments"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="website" className="font-semibold">
                        Website URL
                      </Label>
                      <Input
                        id="website"
                        type="url"
                        value={formData.website}
                        onChange={(e) => handleInputChange("website", e.target.value)}
                        placeholder="https://example.com"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Info Section */}
                <div className="border-l-4 border-red-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Additional Information</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="score" className="font-semibold">
                        Buyer Score (0-100)
                      </Label>
                      <Input
                        id="score"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.score}
                        onChange={(e) => handleInputChange("score", Number.parseInt(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="font-semibold">Tags</Label>
                      <div className="mt-1">
                        <TagSelector
                          value={formData.tags}
                          onChange={(tags) => handleInputChange("tags", tags)}
                          placeholder="Add tags to categorize this buyer..."
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="font-semibold">Assign to Groups</Label>
                      <div className="mt-1 max-h-48 overflow-y-auto">
                        <GroupTreeSelector value={groupIds} onChange={setGroupIds} />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="source" className="font-semibold">
                        How did they hear about us?
                      </Label>
                      <Select value={formData.source} onValueChange={(value) => handleInputChange("source", value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select how this buyer heard about us" />
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="location" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-red-400">📍</span>
                  <strong>Location Settings</strong>
                </CardTitle>
                <CardDescription>Target areas and specific properties where the buyer is interested</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Target Locations Section */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Target Locations</h4>
                  <div>
                    <Label className="font-semibold">Areas of Interest</Label>
                    <div className="mt-1">
                      <LocationSelector
                        value={formData.locations}
                        onChange={(locations) => handleInputChange("locations", locations)}
                        placeholder="Add cities, counties, or states where buyer wants to purchase..."
                      />
                    </div>
                  </div>
                </div>

                {/* Specific Property Interest Section */}
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Specific Property Interest</h4>
                  <PropertySelector value={property} onChange={setProperty} />
                  <p className="text-sm text-muted-foreground mt-1">
                    Select the property this buyer is interested in
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-green-400">⚙️</span>
                  <strong>Property Preferences</strong>
                </CardTitle>
                <CardDescription>Buyer's property criteria and investment parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Property Types Section */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Property Types</h4>
                  <Label className="font-semibold">What types of properties are they interested in?</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {PROPERTY_TYPES.map((type) => (
                      <Badge
                        key={type}
                        variant={formData.property_type.includes(type) ? "default" : "outline"}
                        className="cursor-pointer text-sm px-3 py-1"
                        onClick={() => handlePropertyTypeToggle(type)}
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Price Range Section */}
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">💰 Price Range</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="asking_price_min" className="font-semibold">
                        Minimum Price ($)
                      </Label>
                      <Input
                        id="asking_price_min"
                        type="number"
                        value={formData.asking_price_min}
                        onChange={(e) => handleInputChange("asking_price_min", e.target.value)}
                        placeholder="50,000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="asking_price_max" className="font-semibold">
                        Maximum Price ($)
                      </Label>
                      <Input
                        id="asking_price_max"
                        type="number"
                        value={formData.asking_price_max}
                        onChange={(e) => handleInputChange("asking_price_max", e.target.value)}
                        placeholder="500,000"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Property Specifications Section */}
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">🏠 Property Specifications</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="year_built_min" className="font-semibold">
                        Minimum Year Built
                      </Label>
                      <Input
                        id="year_built_min"
                        type="number"
                        value={formData.year_built_min}
                        onChange={(e) => handleInputChange("year_built_min", e.target.value)}
                        placeholder="1980"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="year_built_max" className="font-semibold">
                        Maximum Year Built
                      </Label>
                      <Input
                        id="year_built_max"
                        type="number"
                        value={formData.year_built_max}
                        onChange={(e) => handleInputChange("year_built_max", e.target.value)}
                        placeholder="2024"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sqft_min" className="font-semibold">
                        Minimum Square Feet
                      </Label>
                      <Input
                        id="sqft_min"
                        type="number"
                        value={formData.sqft_min}
                        onChange={(e) => handleInputChange("sqft_min", e.target.value)}
                        placeholder="1,000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sqft_max" className="font-semibold">
                        Maximum Square Feet
                      </Label>
                      <Input
                        id="sqft_max"
                        type="number"
                        value={formData.sqft_max}
                        onChange={(e) => handleInputChange("sqft_max", e.target.value)}
                        placeholder="5,000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="beds_min" className="font-semibold">
                        Minimum Bedrooms
                      </Label>
                      <Input
                        id="beds_min"
                        type="number"
                        value={formData.beds_min}
                        onChange={(e) => handleInputChange("beds_min", e.target.value)}
                        placeholder="2"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="baths_min" className="font-semibold">
                        Minimum Bathrooms
                      </Label>
                      <Input
                        id="baths_min"
                        type="number"
                        step="0.5"
                        value={formData.baths_min}
                        onChange={(e) => handleInputChange("baths_min", e.target.value)}
                        placeholder="1.5"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Investment Criteria Section */}
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">📊 Investment Criteria</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="min_arv" className="font-semibold">
                        Minimum ARV ($)
                      </Label>
                      <Input
                        id="min_arv"
                        type="number"
                        value={formData.min_arv}
                        onChange={(e) => handleInputChange("min_arv", e.target.value)}
                        placeholder="100,000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="min_arv_percent" className="font-semibold">
                        Minimum ARV Percentage (%)
                      </Label>
                      <Input
                        id="min_arv_percent"
                        type="number"
                        step="0.1"
                        value={formData.min_arv_percent}
                        onChange={(e) => handleInputChange("min_arv_percent", e.target.value)}
                        placeholder="70"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="min_gross_margin" className="font-semibold">
                        Minimum Gross Margin ($)
                      </Label>
                      <Input
                        id="min_gross_margin"
                        type="number"
                        value={formData.min_gross_margin}
                        onChange={(e) => handleInputChange("min_gross_margin", e.target.value)}
                        placeholder="20,000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="max_gross_margin" className="font-semibold">
                        Maximum Gross Margin ($)
                      </Label>
                      <Input
                        id="max_gross_margin"
                        type="number"
                        value={formData.max_gross_margin}
                        onChange={(e) => handleInputChange("max_gross_margin", e.target.value)}
                        placeholder="100,000"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Owner Finance Section */}
                <div className="border-l-4 border-yellow-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800 flex items-center gap-2">
                    <span className="text-yellow-500">💰</span>
                    Owner Finance / Rent to Own / Land Contract
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="down_payment_min" className="font-semibold">
                        Minimum Down Payment ($)
                      </Label>
                      <Input
                        id="down_payment_min"
                        type="number"
                        value={formData.down_payment_min}
                        onChange={(e) => handleInputChange("down_payment_min", e.target.value)}
                        placeholder="5,000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="down_payment_max" className="font-semibold">
                        Maximum Down Payment ($)
                      </Label>
                      <Input
                        id="down_payment_max"
                        type="number"
                        value={formData.down_payment_max}
                        onChange={(e) => handleInputChange("down_payment_max", e.target.value)}
                        placeholder="50,000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthly_payment_min" className="font-semibold">
                        Minimum Monthly Payment ($)
                      </Label>
                      <Input
                        id="monthly_payment_min"
                        type="number"
                        value={formData.monthly_payment_min}
                        onChange={(e) => handleInputChange("monthly_payment_min", e.target.value)}
                        placeholder="500"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthly_payment_max" className="font-semibold">
                        Maximum Monthly Payment ($)
                      </Label>
                      <Input
                        id="monthly_payment_max"
                        type="number"
                        value={formData.monthly_payment_max}
                        onChange={(e) => handleInputChange("monthly_payment_max", e.target.value)}
                        placeholder="2,000"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-pink-500">⭐</span>
                  <strong>Buyer Status & Communication</strong>
                </CardTitle>
                <CardDescription>Set the buyer's status and communication preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status Section */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Lead Status</h4>
                  <div>
                    <Label htmlFor="status" className="font-semibold">
                      Current Buyer Status
                    </Label>
                    <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Special Flags Section */}
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Special Designations</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="vip" className="font-semibold">
                          VIP Status
                        </Label>
                        <p className="text-sm text-muted-foreground">Mark as VIP for priority treatment</p>
                      </div>
                      <Switch
                        id="vip"
                        checked={formData.vip}
                        onCheckedChange={(checked) => handleInputChange("vip", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="vetted" className="font-semibold">
                          Vetted
                        </Label>
                        <p className="text-sm text-muted-foreground">Buyer has been verified/vetted</p>
                      </div>
                      <Switch
                        id="vetted"
                        checked={formData.vetted}
                        onCheckedChange={(checked) => handleInputChange("vetted", checked)}
                      />
                    </div>
                  </div>
                </div>

                {/* Communication Preferences Section */}
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Communication Preferences</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="can_receive_email" className="font-semibold">
                          Can Receive Email
                        </Label>
                        <p className="text-sm text-muted-foreground">Allow email communications</p>
                      </div>
                      <Switch
                        id="can_receive_email"
                        checked={formData.can_receive_email}
                        onCheckedChange={(checked) => handleInputChange("can_receive_email", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="can_receive_sms" className="font-semibold">
                          Can Receive SMS
                        </Label>
                        <p className="text-sm text-muted-foreground">Allow text message communications</p>
                      </div>
                      <Switch
                        id="can_receive_sms"
                        checked={formData.can_receive_sms}
                        onCheckedChange={(checked) => handleInputChange("can_receive_sms", checked)}
                      />
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-bold text-base mb-3 text-gray-800">Additional Notes</h4>
                  <div>
                    <Label htmlFor="notes" className="font-semibold">
                      Notes
                    </Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      placeholder="Additional notes about this buyer..."
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    id="schedule_showing"
                    checked={scheduleShowing}
                    onCheckedChange={setScheduleShowing}
                  />
                  <Label htmlFor="schedule_showing" className="font-medium">
                    Schedule showing after save
                  </Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {duplicateBuyer && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {`Buyer "${duplicateBuyer.fname || ""} ${
                duplicateBuyer.lname || ""
              }" already exists with this email or phone. Update the existing record or edit manually.`}
            </AlertDescription>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={handleConfirmUpdate} disabled={loading}>
                Update Buyer
              </Button>
              {onEditBuyer && (
                <Button size="sm" variant="outline" onClick={handleEditExisting} disabled={loading}>
                  Edit Buyer
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDuplicateBuyer(null)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </Alert>
        )}

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            {!isFirstTab && (
              <Button variant="outline" onClick={handlePrevious} disabled={loading}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
            )}
          </div>

          <div>
            {!isLastTab ? (
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Buyer...
                  </>
                ) : (
                  "Create Buyer"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ScheduleShowingModal
      open={showScheduleModal}
      onOpenChange={setShowScheduleModal}
      buyer={createdBuyerId ? ({ id: createdBuyerId } as Buyer) : null}
      property={scheduleProperty || undefined}
      onSuccess={() => {
        setShowScheduleModal(false)
        setScheduleProperty(null)
        setCreatedBuyerId(null)
      }}
    />
    </>
  )
}
