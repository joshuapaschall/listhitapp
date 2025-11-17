"use client"

import { useState, useEffect, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  User,
  Calendar,
  FileText,
  DollarSign,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  Star,
  CheckCircle,
  Edit,
  Plus,
  Eye,
  Upload,
} from "lucide-react"
import type { Buyer } from "@/lib/supabase"
import EditBuyerModal from "./edit-buyer-modal"
import ScheduleShowingModal from "@/components/showings/schedule-showing-modal"
import { ShowingService } from "@/services/showing-service"

interface BuyerDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  buyer: Buyer | null
  onSuccess?: () => void
}

interface Note {
  id: string
  content: string
  created_at: string
  created_by: string
}

interface Showing {
  id: string
  scheduled_at: string
  status: string
  notes: string | null
  properties?: { id: string; address: string } | null
}

interface Offer {
  id: string
  property_address: string
  offer_amount: number
  status: string
  created_at: string
}

export default function BuyerDetailModal({ open, onOpenChange, buyer, onSuccess }: BuyerDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [showEditModal, setShowEditModal] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [offers, setOffers] = useState<Offer[]>([])
  const [newNote, setNewNote] = useState("")
  const [loading, setLoading] = useState(false)

  const {
    data: showings = [],
    refetch: refetchShowings,
  } = useQuery({
    queryKey: ["buyer-showings", buyer?.id],
    queryFn: () => ShowingService.getShowings({ buyerId: buyer!.id }),
    enabled: !!buyer && open && activeTab === "showings",
  })

  const loadRelatedData = useCallback(async () => {
    if (!buyer) return

    setLoading(true)
    try {
      // Load notes, showings, offers, etc.
      // For now, using placeholder data
      setNotes([
        {
          id: "1",
          content: "Initial contact made. Very interested in investment properties in Atlanta area.",
          created_at: new Date().toISOString(),
          created_by: "John Doe",
        },
      ])



      setOffers([
        {
          id: "1",
          property_address: "456 Oak Ave, Atlanta, GA",
          offer_amount: 85000,
          status: "pending",
          created_at: "2024-01-10T14:30:00Z",
        },
      ])
    } catch (err) {
      console.error("Error loading related data:", err)
    } finally {
      setLoading(false)
    }
  }, [buyer])

  // Load related data when buyer changes
  useEffect(() => {
    if (buyer && open) {
      loadRelatedData()
    }
  }, [buyer, open, loadRelatedData])

  const handleAddNote = async () => {
    if (!newNote.trim() || !buyer) return

    try {
      // In a real app, you'd save this to the database
      const note: Note = {
        id: Date.now().toString(),
        content: newNote,
        created_at: new Date().toISOString(),
        created_by: "Current User",
      }

      setNotes([note, ...notes])
      setNewNote("")
    } catch (err) {
      console.error("Error adding note:", err)
    }
  }

  const formatName = (buyer: Buyer) => {
    if (buyer.full_name) return buyer.full_name
    if (buyer.fname && buyer.lname) return `${buyer.fname} ${buyer.lname}`
    if (buyer.fname) return buyer.fname
    if (buyer.lname) return buyer.lname
    return "Unnamed Buyer"
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (!buyer) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {buyer.vip && <Star className="h-5 w-5 text-amber-500 fill-amber-500" />}
                  {buyer.vetted && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                </div>
                <div>
                  <DialogTitle className="text-xl">{formatName(buyer)}</DialogTitle>
                  <DialogDescription className="flex items-center gap-4">
                    {buyer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {buyer.email}
                      </span>
                    )}
                    {buyer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {buyer.phone}
                      </span>
                    )}
                    {buyer.company && <span className="text-muted-foreground">• {buyer.company}</span>}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-1" />
                  Email
                </Button>
                <Button variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  SMS
                </Button>
                <Button variant="outline" size="sm">
                  <Phone className="h-4 w-4 mr-1" />
                  Call
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">
                <User className="h-4 w-4 mr-1" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="showings">
                <Eye className="h-4 w-4 mr-1" />
                Showings
              </TabsTrigger>
              <TabsTrigger value="offers">
                <DollarSign className="h-4 w-4 mr-1" />
                Offers
              </TabsTrigger>
              <TabsTrigger value="documents">
                <FileText className="h-4 w-4 mr-1" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="notes">
                <MessageSquare className="h-4 w-4 mr-1" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Calendar className="h-4 w-4 mr-1" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span>{buyer.email || "Not provided"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span>{buyer.phone || "Not provided"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Company:</span>
                      <span>{buyer.company || "Not provided"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Website:</span>
                      <span>{buyer.website || "Not provided"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Score:</span>
                      <Badge variant="secondary">{buyer.score}/100</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Preferences Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Investment Preferences</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price Range:</span>
                      <span>
                        {buyer.asking_price_min && buyer.asking_price_max
                          ? `${formatCurrency(buyer.asking_price_min)} - ${formatCurrency(buyer.asking_price_max)}`
                          : "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Property Types:</span>
                      <div className="flex flex-wrap gap-1">
                        {buyer.property_type?.slice(0, 3).map((type, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                        {buyer.property_type && buyer.property_type.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{buyer.property_type.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Min ARV:</span>
                      <span>{buyer.min_arv ? formatCurrency(buyer.min_arv) : "Not specified"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target Locations:</span>
                      <div className="flex flex-wrap gap-1">
                        {buyer.locations?.slice(0, 2).map((location, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            {location}
                          </Badge>
                        ))}
                        {buyer.locations && buyer.locations.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{buyer.locations.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tags */}
              {buyer.tags && buyer.tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {buyer.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="showings" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Property Showings</h3>
                <Button onClick={() => setShowScheduleModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Schedule Showing
                </Button>
              </div>

              <div className="space-y-3">
                {showings.map((showing: Showing) => (
                  <Card key={showing.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{showing.properties?.address ?? "-"}</h4>
                          <p className="text-sm text-muted-foreground">{formatDate(showing.scheduled_at)}</p>
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
                  <div className="text-center py-8 text-muted-foreground">No showings scheduled yet</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="offers" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Offers & Deals</h3>
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Offer
                </Button>
              </div>

              <div className="space-y-3">
                {offers.map((offer) => (
                  <Card key={offer.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{offer.property_address}</h4>
                          <p className="text-lg font-bold text-green-600">{formatCurrency(offer.offer_amount)}</p>
                          <p className="text-sm text-muted-foreground">Created {formatDate(offer.created_at)}</p>
                        </div>
                        <Badge variant={offer.status === "pending" ? "default" : "secondary"}>{offer.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {offers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">No offers created yet</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Documents</h3>
                <Button>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Document
                </Button>
              </div>

              <div className="text-center py-8 text-muted-foreground">No documents uploaded yet</div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Note</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="Add a note about this buyer..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={3}
                    />
                    <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Note
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  {notes.map((note) => (
                    <Card key={note.id}>
                      <CardContent className="pt-4">
                        <p className="mb-2">{note.content}</p>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>By {note.created_by}</span>
                          <span>{formatDate(note.created_at)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <h3 className="text-lg font-semibold">Recent Activity</h3>
              <div className="text-center py-8 text-muted-foreground">No recent activity</div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <EditBuyerModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        buyer={buyer}
        onSuccess={() => {
          setShowEditModal(false)
          if (onSuccess) onSuccess()
        }}
      />
      <ScheduleShowingModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
        onSuccess={refetchShowings}
        buyer={buyer}
      />
    </>
  )
}
