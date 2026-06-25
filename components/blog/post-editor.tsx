"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ExternalLink, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import PostRichEditor from "@/components/blog/post-rich-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { analyzePost, type SeoInput } from "@/lib/blog/seo-coach"
import { SeoCoachPanel } from "@/components/blog/seo-coach-panel"
import { SerpPreview } from "@/components/blog/serp-preview"

export interface PostEditorData {
  id: string
  title: string
  slug: string
  excerpt: string | null
  bodyHtml: string | null
  featuredImageUrl: string | null
  featuredImageAlt: string | null
  focusKeyword: string | null
  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
  authorName: string | null
  category: string | null
  tags: string[]
  status: string
}

const MAX_TAGS = 5
const MAX_TAG_LEN = 40

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

function htmlHasText(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0
}

function SegButton({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {children}
    </button>
  )
}

export function PostEditor({
  mode,
  siteId,
  siteSlug,
  post,
  publicUrl,
  existingCategories = [],
}: {
  mode: "new" | "edit"
  siteId: string
  siteSlug: string
  post?: PostEditorData
  publicUrl?: string
  existingCategories?: string[]
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const ogInputRef = useRef<HTMLInputElement | null>(null)
  const slugEdited = useRef(mode === "edit")
  const publicHost = (publicUrl || "").replace(/^https?:\/\//, "") || siteSlug

  const [savedId, setSavedId] = useState<string | null>(post?.id ?? null)
  const [savedSlug, setSavedSlug] = useState(post?.slug ?? "")
  const [savedStatus, setSavedStatus] = useState(post?.status ?? "draft")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [ogUploading, setOgUploading] = useState(false)
  const [slugOpen, setSlugOpen] = useState(false)

  const [title, setTitle] = useState(post?.title ?? "")
  const [slug, setSlug] = useState(post?.slug ?? "")
  const [bodyHtml, setBodyHtml] = useState(post?.bodyHtml ?? "")
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "")
  const [featuredImageUrl, setFeaturedImageUrl] = useState(post?.featuredImageUrl ?? "")
  const [featuredImageAlt, setFeaturedImageAlt] = useState(post?.featuredImageAlt ?? "")
  const [focusKeyword, setFocusKeyword] = useState(post?.focusKeyword ?? "")
  const [metaTitle, setMetaTitle] = useState(post?.metaTitle ?? "")
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription ?? "")
  const [ogImageUrl, setOgImageUrl] = useState(post?.ogImageUrl ?? "")
  const [authorName, setAuthorName] = useState(post?.authorName ?? "")
  const [category, setCategory] = useState(post?.category ?? "")
  const [tags, setTags] = useState<string[]>(post?.tags ?? [])
  const [tagDraft, setTagDraft] = useState("")
  const [wantLive, setWantLive] = useState((post?.status ?? "draft") === "published")
  const [dirty, setDirty] = useState(false)

  // Native "Leave site?" prompt while there are unsaved edits (mirrors the studio editor).
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  function onTitleChange(v: string) {
    setTitle(v)
    if (!slugEdited.current) setSlug(slugify(v))
    setDirty(true)
  }

  function addTag(raw: string) {
    const t = raw.trim().slice(0, MAX_TAG_LEN)
    if (!t) return
    setTags((prev) => {
      if (prev.length >= MAX_TAGS) return prev
      if (prev.some((x) => x.toLowerCase() === t.toLowerCase())) return prev
      return [...prev, t]
    })
    setTagDraft("")
    setDirty(true)
  }

  function removeTag(idx: number) {
    setTags((prev) => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(tagDraft)
    } else if (e.key === "Backspace" && !tagDraft && tags.length) {
      removeTag(tags.length - 1)
    }
  }

  const canPublish = title.trim().length > 0 && htmlHasText(bodyHtml) && featuredImageUrl.length > 0
  const missing = [
    !title.trim() && "a title",
    !htmlHasText(bodyHtml) && "post content",
    !featuredImageUrl && "a featured image",
  ].filter(Boolean) as string[]

  // Live SEO inputs — fed to the coach panel and used to persist the score on save.
  const seoInput: SeoInput = {
    title,
    slug,
    bodyHtml,
    focusKeyword,
    metaTitle,
    metaDescription,
    featuredImageUrl,
    featuredImageAlt,
    excerpt,
  }

  // Shared signed-URL upload → returns the public URL, or throws.
  async function uploadImage(file: File): Promise<string> {
    const signRes = await fetch(`/api/sites/${siteId}/post-images/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: [{ name: file.name, type: file.type, size: file.size }] }),
    })
    const signData = await signRes.json().catch(() => ({}))
    const entry = signData?.signed?.[0]
    if (!signRes.ok || !entry) throw new Error(signData?.errors?.[0] || "Could not start upload")
    const supabase = supabaseBrowser()
    const { error } = await supabase.storage
      .from("property-images")
      .uploadToSignedUrl(entry.path, entry.token, file, { contentType: file.type })
    if (error) throw new Error(error.message)
    return supabase.storage.from("property-images").getPublicUrl(entry.path).data.publicUrl
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setFeaturedImageUrl(url)
      setDirty(true)
    } catch (e: any) {
      toast.error(e?.message || "Image upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleOgUpload(file: File | undefined) {
    if (!file) return
    setOgUploading(true)
    try {
      const url = await uploadImage(file)
      setOgImageUrl(url)
      setDirty(true)
    } catch (e: any) {
      toast.error(e?.message || "Image upload failed")
    } finally {
      setOgUploading(false)
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Add a title first")
      return
    }
    const publish = wantLive && canPublish
    setSaving(true)
    try {
      const payload = {
        title,
        slug: slug || undefined,
        excerpt: excerpt || null,
        bodyHtml: bodyHtml || null,
        featuredImageUrl: featuredImageUrl || null,
        featuredImageAlt: featuredImageAlt || null,
        focusKeyword: focusKeyword || null,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        ogImageUrl: ogImageUrl || null,
        authorName: authorName || null,
        category: category.trim() || null,
        tags,
        status: publish ? "published" : "draft",
        // Persist the latest live score so the Posts-list chip stays accurate.
        seoScore: analyzePost(seoInput).score,
      }
      if (!savedId) {
        const res = await fetch(`/api/sites/${siteId}/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || "Couldn't save post")
        setDirty(false)
        toast.success(publish ? "Post published" : "Draft saved")
        router.replace(`/websites/${siteId}/posts/${data.id}`)
      } else {
        const res = await fetch(`/api/sites/${siteId}/posts/${savedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || "Couldn't save post")
        setSavedSlug(data.slug ?? savedSlug)
        setSavedStatus(data.status ?? savedStatus)
        setDirty(false)
        toast.success(publish ? "Post published" : "Post saved")
        router.refresh()
      }
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save post")
    } finally {
      setSaving(false)
    }
  }

  const publishedUrl = savedStatus === "published" && savedSlug && publicUrl ? `${publicUrl}/blog/${savedSlug}` : null

  return (
    <div className="mx-auto max-w-6xl">
      {/* Top app bar */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
              <Link href={`/websites/${siteId}/posts`} aria-label="Back to posts">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                savedStatus === "published"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {savedStatus === "published" ? "Live" : "Draft"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <SegButton active={!wantLive} onClick={() => setWantLive(false)}>Draft</SegButton>
              <SegButton active={wantLive} disabled={!canPublish && !wantLive} onClick={() => canPublish && setWantLive(true)}>Live</SegButton>
            </div>
            {publishedUrl && (
              <Button asChild variant="ghost" size="sm">
                <a href={publishedUrl} target="_blank" rel="noreferrer">View <ExternalLink className="h-3.5 w-3.5" /></a>
              </Button>
            )}
            <Button type="button" variant="brand" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : wantLive && canPublish ? "Save & publish" : "Save"}
            </Button>
          </div>
        </div>
        {wantLive && !canPublish && (
          <p className="mt-2 text-xs text-muted-foreground">Add {missing.join(", ")} to publish. Saving now keeps it as a draft.</p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row">
        {/* Center canvas */}
        <div className="min-w-0 flex-1 space-y-3">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Add title"
            aria-label="Post title"
            className="w-full border-0 border-transparent bg-transparent px-0 text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50 focus:ring-0"
          />

          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="truncate">{publicHost}/blog/{slug || "…"}</span>
            <button
              type="button"
              onClick={() => setSlugOpen((v) => !v)}
              className="shrink-0 font-sans text-xs font-medium text-primary hover:underline"
            >
              {slugOpen ? "done" : "edit"}
            </button>
          </div>
          {slugOpen && (
            <Input
              autoFocus
              placeholder="post-slug"
              value={slug}
              onChange={(e) => {
                slugEdited.current = true
                setSlug(slugify(e.target.value))
                setDirty(true)
              }}
              className="max-w-md font-mono text-sm"
            />
          )}

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <PostRichEditor
              siteId={siteId}
              value={bodyHtml}
              onChange={(v) => { setBodyHtml(v); setDirty(true) }}
              minHeight={420}
            />
          </div>
        </div>

        {/* Right inspector */}
        <aside className="lg:w-[320px] lg:shrink-0">
          <div className="lg:sticky lg:top-20 space-y-4">
            <Accordion
              type="multiple"
              defaultValue={["featured", "excerpt", "taxonomy", "search", "coach"]}
              className="rounded-lg border border-border bg-card px-4"
            >
              {/* Featured image */}
              <AccordionItem value="featured">
                <AccordionTrigger className="text-sm">Featured image</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/heic"
                    className="hidden"
                    onChange={(e) => {
                      handleUpload(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />
                  {featuredImageUrl ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={featuredImageUrl} alt={featuredImageAlt || "Featured"} className="h-20 w-32 rounded-md border border-border object-cover" />
                      <div className="flex flex-col gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Replace"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setFeaturedImageUrl(""); setDirty(true) }} disabled={uploading}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full">
                      {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Upload image</>}
                    </Button>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="post-alt" className="text-sm">Alt text</Label>
                    <Input id="post-alt" placeholder="Describe the image" value={featuredImageAlt} onChange={(e) => { setFeaturedImageAlt(e.target.value); setDirty(true) }} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Excerpt */}
              <AccordionItem value="excerpt">
                <AccordionTrigger className="text-sm">Excerpt</AccordionTrigger>
                <AccordionContent>
                  <Textarea id="post-excerpt" rows={3} placeholder="Short summary shown on the blog index." value={excerpt} onChange={(e) => { setExcerpt(e.target.value); setDirty(true) }} />
                </AccordionContent>
              </AccordionItem>

              {/* Categories & tags */}
              <AccordionItem value="taxonomy">
                <AccordionTrigger className="text-sm">Categories &amp; tags</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="post-category" className="text-sm">Category</Label>
                    <Input
                      id="post-category"
                      list="post-category-options"
                      placeholder="e.g. Selling tips"
                      value={category}
                      onChange={(e) => { setCategory(e.target.value); setDirty(true) }}
                    />
                    <datalist id="post-category-options">
                      {existingCategories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="post-tags" className="text-sm">Tags</Label>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((t, i) => (
                          <span key={`${t}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                            {t}
                            <button type="button" aria-label={`Remove ${t}`} onClick={() => removeTag(i)} className="text-muted-foreground hover:text-foreground">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <Input
                      id="post-tags"
                      placeholder={tags.length >= MAX_TAGS ? "Max 5 tags" : "Type a tag, press Enter"}
                      value={tagDraft}
                      disabled={tags.length >= MAX_TAGS}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={onTagKeyDown}
                      onBlur={() => addTag(tagDraft)}
                    />
                    <p className="text-xs text-muted-foreground">{tags.length}/{MAX_TAGS} tags</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Search appearance */}
              <AccordionItem value="search">
                <AccordionTrigger className="text-sm">Search appearance</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="post-keyword" className="text-sm">Focus keyword</Label>
                    <Input id="post-keyword" placeholder="e.g. sell my house fast atlanta" value={focusKeyword} onChange={(e) => { setFocusKeyword(e.target.value); setDirty(true) }} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="post-metatitle" className="text-sm">Meta title</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">{metaTitle.length}/60</span>
                    </div>
                    <Input id="post-metatitle" placeholder="Defaults to the post title" value={metaTitle} onChange={(e) => { setMetaTitle(e.target.value); setDirty(true) }} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="post-metadesc" className="text-sm">Meta description</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">{metaDescription.length}/155</span>
                    </div>
                    <Textarea id="post-metadesc" rows={2} placeholder="Defaults to the excerpt" value={metaDescription} onChange={(e) => { setMetaDescription(e.target.value); setDirty(true) }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Social image (OG)</Label>
                    <input
                      ref={ogInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/heic"
                      className="hidden"
                      onChange={(e) => {
                        handleOgUpload(e.target.files?.[0])
                        e.target.value = ""
                      }}
                    />
                    {ogImageUrl ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ogImageUrl} alt="Social share" className="h-16 w-28 rounded-md border border-border object-cover" />
                        <div className="flex flex-col gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => ogInputRef.current?.click()} disabled={ogUploading}>
                            {ogUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Replace"}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setOgImageUrl(""); setDirty(true) }} disabled={ogUploading}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" size="sm" onClick={() => ogInputRef.current?.click()} disabled={ogUploading} className="w-full">
                        {ogUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : "Select image"}
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">Falls back to the featured image when empty.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="post-author" className="text-sm">Author name</Label>
                    <Input id="post-author" placeholder="Shown on the post" value={authorName} onChange={(e) => { setAuthorName(e.target.value); setDirty(true) }} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* SEO coach */}
              <AccordionItem value="coach" className="border-b-0">
                <AccordionTrigger className="text-sm">SEO coach</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <SerpPreview
                    host={publicHost}
                    slug={slug}
                    title={title}
                    metaTitle={metaTitle}
                    metaDescription={metaDescription}
                    excerpt={excerpt}
                  />
                  <SeoCoachPanel {...seoInput} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </aside>
      </div>
    </div>
  )
}
