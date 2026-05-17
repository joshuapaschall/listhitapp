"use client"

import { useEditor, EditorContent, Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"
import { useEffect } from "react"
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  List, ListOrdered, Quote, Code, Strikethrough, Undo, Redo, RemoveFormatting,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  className?: string
  toolbarClassName?: string
  autoFocus?: boolean
  onReady?: (editor: Editor) => void
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "",
  minHeight = 200,
  className,
  toolbarClassName,
  autoFocus = false,
  onReady,
}: RichTextEditorProps) {
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
    ],
    content: value,
    autofocus: autoFocus,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none px-3 py-2",
          "[&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5",
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

  useEffect(() => {
    if (editor && onReady) onReady(editor)
  }, [editor, onReady])

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
      className={cn(
        "rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
        active && "bg-muted text-foreground",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  )

  return (
    <div className={cn("flex flex-col", className)}>
      <div className={cn("flex items-center gap-0.5 border-b px-2 py-1", toolbarClassName)}>
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo className="h-3.5 w-3.5" />
        </Btn>
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
