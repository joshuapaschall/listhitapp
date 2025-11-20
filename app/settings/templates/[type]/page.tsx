import { notFound } from "next/navigation"
import TemplateList from "./template-list"
import type { TemplateSlug } from "../template-types"
import { templateTypeConfig } from "../template-types"

export default function TemplateListPage({ params }: { params: { type: TemplateSlug } }) {
  const slug = params.type as TemplateSlug
  if (!templateTypeConfig[slug]) {
    notFound()
  }
  return <TemplateList slug={slug} />
}
