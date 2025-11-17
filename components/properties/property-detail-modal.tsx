"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Property } from "@/lib/supabase"
import { PropertyService } from "@/services/property-service"
import ScheduleShowingModal from "@/components/showings/schedule-showing-modal"
import DeletePropertyModal from "./delete-property-modal"

interface PropertyDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string | null
  onUpdated?: () => void
}

export default function PropertyDetailModal({
  open,
  onOpenChange,
  propertyId,
  onUpdated,
}: PropertyDetailModalProps) {
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (open && propertyId) {
      setLoading(true)
      PropertyService.getProperty(propertyId)
        .then((data) => setProperty(data))
        .catch((err) => {
          console.error("Error loading property:", err)
          setProperty(null)
        })
        .finally(() => setLoading(false))
    }
  }, [open, propertyId])

  const handleClose = () => {
    if (!loading) {
      setShowSchedule(false)
      setShowDelete(false)
      onOpenChange(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {property?.address}
              {property?.city ? `, ${property.city}` : ""}
            </DialogTitle>
            {property?.status && (
              <DialogDescription className="capitalize">
                {property.status.replace("_", " ")}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            {loading && <p>Loading...</p>}
            {!loading && property && (
              <>
                {property.price != null && (
                  <p className="font-medium">Price: ${property.price}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {property.bedrooms != null && <span>Bedrooms: {property.bedrooms}</span>}
                  {property.bathrooms != null && <span>Bathrooms: {property.bathrooms}</span>}
                  {property.sqft != null && <span>Sqft: {property.sqft}</span>}
                  {property.property_type && <span>Type: {property.property_type}</span>}
                  {property.condition && <span>Condition: {property.condition}</span>}
                  {property.priority && <span>Priority: {property.priority}</span>}
                </div>
                {property.description && <p>{property.description}</p>}
                {property.tags && property.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {property.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {property.short_url && (
                  <p>
                    Short Link:{" "}
                    <a
                      href={property.short_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      {property.short_url}
                    </a>
                  </p>
                )}
              </>
            )}
          </div>
          {property && (
            <DialogFooter className="flex justify-end gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/properties/edit/${property.id}`}>Edit</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSchedule(true)}>
                Schedule Showing
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
                Delete
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <ScheduleShowingModal
        open={showSchedule}
        onOpenChange={setShowSchedule}
        property={property}
        onSuccess={onUpdated}
      />
      <DeletePropertyModal
        open={showDelete}
        onOpenChange={setShowDelete}
        property={property}
        onSuccess={() => {
          if (onUpdated) onUpdated()
          handleClose()
        }}
      />
    </>
  )
}
