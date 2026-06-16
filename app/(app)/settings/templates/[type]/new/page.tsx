import { notFound } from "next/navigation"
import TemplateEditor from "../template-editor"
import type { TemplateSlug } from "../../template-types"
import { templateTypeConfig } from "../../template-types"

export default function NewTemplatePage({ params }: { params: { type: TemplateSlug } }) {
  const slug = params.type as TemplateSlug
  if (!templateTypeConfig[slug]) {
    notFound()
  }
  return <TemplateEditor slug={slug} mode="new" />
}
