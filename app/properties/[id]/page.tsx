import MainLayout from "@/components/layout/main-layout"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import ScheduleShowingButton from "@/components/showings/schedule-showing-button"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import placeholderImage from "@/public/placeholder.jpg"

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", params.id)
    .maybeSingle()

  if (error) {
    console.error("Error loading property:", error)
  }

  const { data: imageData } = await supabase
    .from("property_images")
    .select("image_url")
    .eq("property_id", params.id)
    .order("sort_order")
    .limit(1)
    .maybeSingle()

  if (!data) {
    return (
      <MainLayout>
        <div className="p-4">Property not found.</div>
      </MainLayout>
    )
  }

  const imageSrc = imageData?.image_url || placeholderImage
  const altText = `${data.address}${data.city ? `, ${data.city}` : ""}`

  return (
    <MainLayout>
      <div className="p-4 max-w-3xl mx-auto">
        <Card>
          <Image
            src={imageSrc}
            alt={altText}
            width={800}
            height={450}
            className="w-full h-60 object-cover rounded-t-lg"
            priority
          />
          <CardContent className="space-y-4">
            <h1 className="text-2xl font-bold">
              {data.address}
              {data.city ? `, ${data.city}` : ""}
            </h1>
            {data.price && <p>Price: ${data.price}</p>}
            <p>Status: {data.status}</p>
            {data.description && <p>{data.description}</p>}
            {data.tags && data.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {data.video_link && (
              <p>
                Video:{" "}
                <a
                  href={data.video_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  {data.video_link}
                </a>
              </p>
            )}
            <ScheduleShowingButton property={data} className="mt-4" />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
