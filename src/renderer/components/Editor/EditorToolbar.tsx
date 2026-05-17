import { type Editor } from '@tiptap/react'
import { useState } from 'react'
import {
  Bold, Italic, Underline, Quote, List, ListOrdered,
  Heading1, Heading2, Heading3, Undo, Redo, Minus, Palette,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeSettings } from './ThemeSettings'

interface Props {
  editor: Editor | null
}

const tools = [
  { key: 'bold', icon: Bold, action: (e: Editor) => e.chain().focus().toggleBold().run() },
  { key: 'italic', icon: Italic, action: (e: Editor) => e.chain().focus().toggleItalic().run() },
  { key: 'underline', icon: Underline, action: (e: Editor) => e.chain().focus().toggleUnderline().run() },
  { type: 'divider' },
  { key: 'h1', icon: Heading1, action: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { key: 'h2', icon: Heading2, action: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { key: 'h3', icon: Heading3, action: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { type: 'divider' },
  { key: 'blockquote', icon: Quote, action: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
  { key: 'bulletList', icon: List, action: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  { key: 'orderedList', icon: ListOrdered, action: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
  { key: 'horizontalRule', icon: Minus, action: (e: Editor) => e.chain().focus().setHorizontalRule().run() },
  { type: 'divider' },
  { key: 'undo', icon: Undo, action: (e: Editor) => e.chain().focus().undo().run() },
  { key: 'redo', icon: Redo, action: (e: Editor) => e.chain().focus().redo().run() },
]

export function EditorToolbar({ editor }: Props) {
  const [showThemeSettings, setShowThemeSettings] = useState(false)
  if (!editor) return null

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card/50 flex-wrap">
      {tools.map((tool, i) => {
        if ('type' in tool && tool.type === 'divider') {
          return <div key={i} className="w-px h-5 bg-border mx-1" />
        }
        const t = tool as typeof tools[number] & { key: string; icon: typeof Bold; action: (e: Editor) => void }
        const isActive = editor.isActive(t.key)
        return (
          <button
            key={t.key}
            onClick={() => t.action(editor)}
            className={cn(
              'p-1.5 rounded hover:bg-accent transition-colors',
              isActive && 'bg-primary/10 text-primary'
            )}
            title={t.key}
          >
            <t.icon className="w-4 h-4" />
          </button>
        )
      })}

      <div className="w-px h-5 bg-border mx-1" />

      {/* Theme settings */}
      <div className="relative">
        <button
          onClick={() => setShowThemeSettings(!showThemeSettings)}
          className="p-1.5 rounded hover:bg-accent transition-colors"
          title="写作主题"
        >
          <Palette className="w-4 h-4" />
        </button>
        <ThemeSettings
          open={showThemeSettings}
          onClose={() => setShowThemeSettings(false)}
        />
      </div>

      <div className="flex-1" />
    </div>
  )
}
