"use client";

import { useParams } from "next/navigation";

import PropertyEditor from "@/components/properties/property-editor";

export default function EditPropertyPage() {
  const params = useParams() as { id: string };
  return <PropertyEditor mode="edit" propertyId={params.id} />;
}
