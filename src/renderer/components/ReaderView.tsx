import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Minus, BookOpen } from 'lucide-react'
import type { Chapter } from '@/types'

interface Props {
  novelId: number
  onSelectChapter?: (chapterId: number) => void
  onBack: () => void
}

export function ReaderView({ novelId, onSelectChapter, onBack }: Props) {
  const [chapters, setChapters] = useState<(Chapter & { volume_title?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [novelTitle, setNovelTitle] = useState('')
  const [fontSize, setFontSize] = useState(() => {
    const v = document.documentElement.style.getPropertyValue('--editor-font-size')
    return v ? parseInt(v) : 15
  })

  useEffect(() => {
    const load = async () => {
      const [novel, chaps] = await Promise.all([
        window.api.novel.get(novelId),
        window.api.chapter.listByNovel(novelId),
      ])
      if (novel) setNovelTitle(novel.title)
      setChapters(chaps)
      setLoading(false)
    }
    load()
  }, [novelId])

  const adjustFontSize = (delta: number) => {
    setFontSize(prev => {
      const next = Math.max(12, Math.min(24, prev + delta))
      document.documentElement.style.setProperty('--editor-font-size', `${next}px`)
      return next
    })
  }

  // Build concatenated HTML
  let currentVolume = ''
  const parts: string[] = []

  for (const ch of chapters) {
    if (ch.volume_title && ch.volume_title !== currentVolume) {
      currentVolume = ch.volume_title
      parts.push(`<div class="reader-volume-sep">${currentVolume}</div>`)
    }
    parts.push(
      `<h2 class="reader-chapter-title" data-chapter-id="${ch.id}">${ch.title}</h2>` +
      (ch.content || '<p></p>')
    )
  }

  const html = parts.join('')

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const titleEl = target.closest('.reader-chapter-title') as HTMLElement | null
    if (titleEl && titleEl.dataset.chapterId) {
      onSelectChapter?.(parseInt(titleEl.dataset.chapterId))
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center text-muted-foreground">
        <span>加载中...</span>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <BookOpen className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-sm">{novelTitle}</span>
        <span className="text-xs text-muted-foreground">
          共 {chapters.length} 章
        </span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{fontSize}px</span>
        <button
          onClick={() => adjustFontSize(-1)}
          disabled={fontSize <= 12}
          className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-30"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => adjustFontSize(1)}
          disabled={fontSize >= 24}
          className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-30"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Reading content */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="tiptap-editor"
          style={{ paddingTop: '2rem', paddingBottom: '4rem' }}
        >
          <div
            className="ProseMirror"
            onClick={handleContentClick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </main>
  )
}
