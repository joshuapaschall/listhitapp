"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"
import Image from "@tiptap/extension-image"
import { useEffect, useRef } from "react"
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  List, ListOrdered, Quote, Code, Strikethrough, Undo, Redo, RemoveFormatting,
  ImagePlus,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { supabaseBrowser } from "@/lib/supabase-browser"

interface PostRichEditorProps {
  value: string
  onChange: (html: string) => void
  siteId: string
  placeholder?: string
  minHeight?: number
}

export default function PostRichEditor({
  value,
  onChange,
  siteId,
  placeholder = "Write your post…",
  minHeight = 420,
}: PostRichEditorProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "underline text-primary" },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: "rounded-lg" },
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none px-4 py-3",
          "[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2",
          "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold",
          "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold",
          "[&_img]:my-4 [&_img]:rounded-lg [&_img]:max-w-full",
        ),
        style: `min-height: ${minHeight}px;`,
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  const handleLink = () => {
    const previousUrl = editor.getAttributes("link").href
    const url = window.prompt("URL", previousUrl || "https://")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return
    const alt = window.prompt("Image alt text (for SEO & accessibility)", "") ?? ""
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
      editor.chain().focus().setImage({ src: url, alt }).run()
    } catch (e: any) {
      toast.error(e?.message || "Image upload failed")
    }
  }

  const Btn = ({
    onClick, active, disabled, title, children,
  }: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    title: string
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
        active && "bg-muted text-foreground",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  )

  const HeadingBtn = ({ level, label }: { level: 2 | 3; label: string }) => (
    <button
      type="button"
      onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
      title={`Heading ${level}`}
      aria-label={`Heading ${level}`}
      className={cn(
        "rounded px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
        editor.isActive("heading", { level }) && "bg-muted text-foreground",
      )}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic"
        className="hidden"
        onChange={(e) => {
          handleImageFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />

      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo className="h-3.5 w-3.5" />
        </Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Paragraph"
          aria-label="Paragraph"
          className={cn(
            "rounded px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
            editor.isActive("paragraph") && "bg-muted text-foreground",
          )}
        >
          P
        </button>
        <HeadingBtn level={2} label="H2" />
        <HeadingBtn level={3} label="H3" />
        <span className="mx-1 h-4 w-px bg-border" />
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        <Btn onClick={handleLink} active={editor.isActive("link")} title="Link">
          <LinkIcon className="h-3.5 w-3.5" />
        </Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
          <Quote className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code">
          <Code className="h-3.5 w-3.5" />
        </Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        <Btn onClick={() => imageInputRef.current?.click()} title="Insert image">
          <ImagePlus className="h-3.5 w-3.5" />
        </Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        <Btn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear formatting">
          <RemoveFormatting className="h-3.5 w-3.5" />
        </Btn>
      </div>

      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: hsl(var(--muted-foreground));
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
