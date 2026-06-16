import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import MainLayout from "@/components/layout/main-layout"
import MapPreview from "@/components/properties/map-preview"
import ScheduleShowingButton from "@/components/showings/schedule-showing-button"
import { supabase } from "@/lib/supabase"
import placeholderImage from "@/public/placeholder.jpg"

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const { data: property } = await supabase.from("properties").select("*").eq("id", params.id).maybeSingle()
  const { data: images } = await supabase.from("property_images").select("image_url").eq("property_id", params.id).order("sort_order")
  const { data: buyers } = await supabase.from("property_buyers").select("buyers:buyer_id(id,full_name,city,state)").eq("property_id", params.id)

  if (!property) return <MainLayout><div className="p-4">Property not found.</div></MainLayout>

  const statusTone = property.status === "sold" ? "destructive" : property.status === "under_contract" ? "secondary" : "default"
  const imageList = images?.length ? images : [{ image_url: placeholderImage.src }]

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4">
        <Card className="overflow-hidden">
          <div className="grid gap-2 md:grid-cols-2">{imageList.map((img, i) => <Image key={img.image_url + i} src={img.image_url} alt={property.address} width={1200} height={600} className="h-64 w-full object-cover" priority={i === 0} />)}</div>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start justify-between"><div><h1 className="text-3xl font-bold">{property.address}</h1><p className="text-muted-foreground">{[property.city, property.state, property.zip].filter(Boolean).join(", ")}</p></div><Badge variant={statusTone}>{property.status?.replace("_", " ")}</Badge></div>
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-4"><Stat label="Beds" value={property.bedrooms ?? "-"} /><Stat label="Baths" value={property.bathrooms ?? "-"} /><Stat label="Sq Ft" value={property.sqft?.toLocaleString() ?? "-"} /><Stat label="Price" value={property.price ? `$${Number(property.price).toLocaleString()}` : "-"} /></div>
            <div className="flex flex-wrap gap-2"><Link href={`/properties/edit/${property.id}`}><Button>Edit</Button></Link><ScheduleShowingButton property={property} /><Button variant="secondary">Create Offer</Button><Button variant="outline">Generate Short Link</Button></div>
          </CardContent>
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
          <Card><CardHeader><CardTitle>Disposition Details</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm"><Detail label="Type" value={property.property_type} /><Detail label="Condition" value={property.condition} /><Detail label="Strategy" value={property.disposition_strategy} /><Detail label="Buyer Fit" value={property.buyer_fit} /><Detail label="Occupancy" value={property.occupancy} /><Detail label="Priority" value={property.priority} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Map</CardTitle></CardHeader><CardContent>{property.latitude && property.longitude ? <MapPreview latitude={property.latitude} longitude={property.longitude} className="h-[280px] overflow-hidden rounded-lg" /> : <div className="flex h-[280px] items-center justify-center rounded-lg border text-muted-foreground">No map coordinates available</div>}</CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle>Matched / Linked Buyers</CardTitle></CardHeader><CardContent className="space-y-2">{buyers?.length ? buyers.map((row, i) => <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2"><span>{(row as { buyers?: { full_name?: string } }).buyers?.full_name || "Unnamed Buyer"}</span></div>) : <p className="text-sm text-muted-foreground">No linked buyers for this property yet.</p>}</CardContent></Card>
      </div>
    </MainLayout>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) { return <div><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div> }
function Detail({ label, value }: { label: string; value: string | null }) { return <div><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="font-medium">{value || "-"}</p></div> }
