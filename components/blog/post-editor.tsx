"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import RichTextEditor from "@/components/gmail/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { analyzePost, type SeoInput } from "@/lib/blog/seo-coach"
import { SeoCoachPanel } from "@/components/blog/seo-coach-panel"

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
  status: string
}

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
}: {
  mode: "new" | "edit"
  siteId: string
  siteSlug: string
  post?: PostEditorData
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const slugEdited = useRef(mode === "edit")

  const [savedId, setSavedId] = useState<string | null>(post?.id ?? null)
  const [savedSlug, setSavedSlug] = useState(post?.slug ?? "")
  const [savedStatus, setSavedStatus] = useState(post?.status ?? "draft")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [title, setTitle] = useState(post?.title ?? "")
  const [slug, setSlug] = useState(post?.slug ?? "")
  const [bodyHtml, setBodyHtml] = useState(post?.bodyHtml ?? "")
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "")
  const [featuredImageUrl, setFeaturedImageUrl] = useState(post?.featuredImageUrl ?? "")
  const [featuredImageAlt, setFeaturedImageAlt] = useState(post?.featuredImageAlt ?? "")
  const [focusKeyword, setFocusKeyword] = useState(post?.focusKeyword ?? "")
  const [metaTitle, setMetaTitle] = useState(post?.metaTitle ?? "")
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription ?? "")
  const [authorName, setAuthorName] = useState(post?.authorName ?? "")
  const [wantLive, setWantLive] = useState((post?.status ?? "draft") === "published")

  function onTitleChange(v: string) {
    setTitle(v)
    if (!slugEdited.current) setSlug(slugify(v))
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

  async function handleUpload(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
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
      const url = supabase.storage.from("property-images").getPublicUrl(entry.path).data.publicUrl
      setFeaturedImageUrl(url)
    } catch (e: any) {
      toast.error(e?.message || "Image upload failed")
    } finally {
      setUploading(false)
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
        authorName: authorName || null,
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
        toast.success(publish ? "Post published" : "Post saved")
        router.refresh()
      }
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save post")
    } finally {
      setSaving(false)
    }
  }

  const publishedUrl = savedStatus === "published" && savedSlug ? `https://${siteSlug}.listhit.io/blog/${savedSlug}` : null

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Sticky header */}
        <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="truncate text-lg font-bold tracking-tight">{title.trim() || (mode === "new" ? "New post" : "Edit post")}</h1>
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

      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-5">
        {/* Title + slug */}
        <Card className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="post-title">Title</Label>
            <Input id="post-title" placeholder="Post title" value={title} onChange={(e) => onTitleChange(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="post-slug">URL slug</Label>
            <Input
              id="post-slug"
              placeholder="post-slug"
              value={slug}
              onChange={(e) => {
                slugEdited.current = true
                setSlug(slugify(e.target.value))
              }}
            />
            <p className="font-mono text-xs text-muted-foreground">{siteSlug}.listhit.io/blog/{slug || "…"}</p>
          </div>
        </Card>

        {/* Body */}
        <Card className="space-y-2 p-5">
          <Label>Content</Label>
          <div className="overflow-hidden rounded-lg border border-border">
            <RichTextEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Write your post…" minHeight={280} />
          </div>
        </Card>

        {/* Featured image */}
        <Card className="space-y-3 p-5">
          <Label>Featured image</Label>
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
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Replace"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFeaturedImageUrl("")} disabled={uploading}>
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
            <Input id="post-alt" placeholder="Describe the image" value={featuredImageAlt} onChange={(e) => setFeaturedImageAlt(e.target.value)} />
          </div>
        </Card>

        {/* Excerpt */}
        <Card className="space-y-2 p-5">
          <Label htmlFor="post-excerpt">Excerpt</Label>
          <Textarea id="post-excerpt" rows={3} placeholder="Short summary shown on the blog index." value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </Card>

        {/* Search appearance */}
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">Search appearance</h2>
          <div className="space-y-1.5">
            <Label htmlFor="post-keyword" className="text-sm">Focus keyword</Label>
            <Input id="post-keyword" placeholder="e.g. sell my house fast atlanta" value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-metatitle" className="text-sm">Meta title</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{metaTitle.length}/60</span>
            </div>
            <Input id="post-metatitle" placeholder="Defaults to the post title" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-metadesc" className="text-sm">Meta description</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{metaDescription.length}/155</span>
            </div>
            <Textarea id="post-metadesc" rows={2} placeholder="Defaults to the excerpt" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="post-author" className="text-sm">Author name</Label>
            <Input id="post-author" placeholder="Shown on the post" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
          </div>
        </Card>
        </div>

        {/* SEO coach right rail */}
        <aside className="lg:w-[280px] lg:shrink-0">
          <div className="lg:sticky lg:top-20">
            <SeoCoachPanel {...seoInput} />
          </div>
        </aside>
      </div>
    </div>
  )
}
