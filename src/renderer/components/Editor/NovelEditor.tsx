import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import { FileText, BookOpen, Plus, GripVertical } from 'lucide-react'
import Typography from '@tiptap/extension-typography'
import Link from '@tiptap/extension-link'
import { InputRule, wrappingInputRule, Extension } from '@tiptap/core'
import { EditorToolbar } from './EditorToolbar'
import { WordCount } from './WordCount'
import type { Chapter, Volume } from '@/types'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent, DragOverlay, DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const MarkdownShortcuts = Extension.create({
  name: 'markdownShortcuts',
  addInputRules() {
    return [
      // Blockquote: "> " at start of paragraph (use wrappingInputRule since blockquote wraps content)
      wrappingInputRule({
        find: /^>\s$/,
        type: this.editor.schema.nodes.blockquote,
      }),
      // Horizontal rule: "---"
      new InputRule({
        find: /^---$/,
        handler: ({ state, range }) => {
          state.tr
            .delete(range.from, range.to)
            .insert(range.from, state.schema.nodes.horizontalRule.create())
        },
      }),
      // Bullet list "- " is already handled by StarterKit's BulletList extension
    ]
  },
})

const WritingKeyboardShortcuts = Extension.create({
  name: 'writingKeyboardShortcuts',
  addKeyboardShortcuts() {
    return {
      // Tab: indent (sink list item) or insert 2 spaces in paragraph
      Tab: () => {
        const { $from } = this.editor.state.selection
        if ($from.parent.type.name === 'listItem') {
          return this.editor.chain().focus().sinkListItem('listItem').run()
        }
        // In a paragraph: insert 2 spaces for visual indent (shown in editor, collapsed in HTML)
        this.editor.chain().focus().insertContent('  ').run()
        return true
      },
      'Shift-Tab': () => {
        const { $from } = this.editor.state.selection
        if ($from.parent.type.name === 'listItem') {
          return this.editor.chain().focus().liftListItem('listItem').run()
        }
        return true
      },
      'Mod-k': () => {
        const url = window.prompt('链接地址:')
        if (url) {
          const { from, to } = this.editor.state.selection
          if (from !== to) {
            const href = /^https?:\/\//.test(url) ? url : `https://${url}`
            this.editor.chain().focus().setLink({ href }).run()
          } else {
            alert('请先选中要添加链接的文字')
          }
        }
        return true
      },
      'Mod-Enter': () => {
        this.editor.chain().focus().setHorizontalRule().run()
        return true
      },
    }
  },
})

function SortableChapterItem({ chap, isActive, onSelect }: {
  chap: Chapter & { volume_title?: string }
  isActive: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chap.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center group">
      <button {...attributes} {...listeners}
        className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity cursor-grab shrink-0"
        title="拖拽排序">
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </button>
      <button
        onClick={onSelect}
        className={`flex-1 text-left px-2 py-1 text-sm hover:bg-accent transition-colors truncate
          ${isActive ? 'bg-accent text-primary font-medium' : 'text-foreground'}`}
      >
        {chap.title}
        <span className="text-xs text-muted-foreground ml-1">({chap.word_count}字)</span>
      </button>
    </div>
  )
}

interface Props {
  novelId: number
  chapterId: number | null
  onChapterChange: (id: number) => void
  onTextSelect: (text: string) => void
  focusMode: boolean
  onToggleFocus: () => void
  typewriterMode: boolean
  onToggleTypewriter: () => void
}

export function NovelEditor({ novelId, chapterId, onChapterChange, onTextSelect, focusMode, onToggleFocus, typewriterMode, onToggleTypewriter }: Props) {
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [chapters, setChapters] = useState<(Chapter & { volume_title?: string })[]>([])
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null)
  const [title, setTitle] = useState('')
  const [totalWords, setTotalWords] = useState(0)
  const [novelTitle, setNovelTitle] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const isSaving = useRef(false)

  const [activeDragId, setActiveDragId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: focusMode ? '专注写作...' : '开始输入你的故事...' }),
      Underline,
      CharacterCount,
      Typography,
      Link.configure({ openOnClick: false }),
      MarkdownShortcuts,
      WritingKeyboardShortcuts,
    ],
    onUpdate: ({ editor }) => {
      const text = editor.state.doc.textBetween(
        editor.state.selection.from, editor.state.selection.to, ' '
      )
      onTextSelect(text)
      scheduleSave()
    },
    onSelectionUpdate: ({ editor }) => {
      const text = editor.state.doc.textBetween(
        editor.state.selection.from, editor.state.selection.to, ' '
      )
      onTextSelect(text)
    },
  })

  // Record word count when saving
  const recordWords = useCallback(async (count: number) => {
    if (count > 0) {
      await window.api.stat.recordWords(novelId, count).catch(() => {})
    }
  }, [novelId])

  const loadData = useCallback(async () => {
    const [novel, vols, chaps, wordCount] = await Promise.all([
      window.api.novel.get(novelId),
      window.api.volume.listByNovel(novelId),
      window.api.chapter.listByNovel(novelId),
      window.api.novel.wordCount(novelId),
    ])
    if (novel) setNovelTitle(novel.title)
    setVolumes(vols)
    setChapters(chaps)
    setTotalWords(wordCount)
  }, [novelId])

  useEffect(() => { loadData() }, [loadData])

  // Load chapter when selected
  useEffect(() => {
    if (!chapterId || chapters.length === 0) return
    const loadChapter = async () => {
      const ch = await window.api.chapter.get(chapterId)
      if (ch) {
        setCurrentChapter(ch)
        setTitle(ch.title)
        if (editor && ch.content !== editor.getHTML()) {
          editor.commands.setContent(ch.content)
        }
      }
    }
    loadChapter()
  }, [chapterId, chapters, editor])

  // Preload adjacent chapters
  useEffect(() => {
    if (!chapterId || chapters.length === 0) return
    const ordered: number[] = []
    volumes.forEach((vol) => {
      chapters.filter((c) => c.volume_id === vol.id).forEach((c) => ordered.push(c.id))
    })
    chapters.filter((c) => !c.volume_id).forEach((c) => ordered.push(c.id))

    const idx = ordered.indexOf(chapterId)
    const toPreload: number[] = []
    if (idx > 0) toPreload.push(ordered[idx - 1])
    if (idx < ordered.length - 1) toPreload.push(ordered[idx + 1])
    toPreload.forEach((id) => {
      window.api.chapter.get(id).catch(() => {})
    })
  }, [chapterId, volumes, chapters])

  // Listen for search navigation
  useEffect(() => {
    const handler = (e: Event) => {
      const { chapterId: targetId } = (e as CustomEvent).detail
      if (targetId) onChapterChange(targetId)
    }
    window.addEventListener('navigate-chapter', handler)
    return () => window.removeEventListener('navigate-chapter', handler)
  }, [onChapterChange])

  // Chapter switch shortcut: Cmd/Ctrl + Left/Right Arrow
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !chapterId) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        // Build flat ordered list from volumes+chapters
        const ordered: number[] = []
        volumes.forEach((vol) => {
          chapters
            .filter((c) => c.volume_id === vol.id)
            .forEach((c) => ordered.push(c.id))
        })
        // Add unassigned chapters at end
        chapters
          .filter((c) => !c.volume_id)
          .forEach((c) => ordered.push(c.id))

        const idx = ordered.indexOf(chapterId)
        if (e.key === 'ArrowLeft' && idx > 0) {
          onChapterChange(ordered[idx - 1])
        } else if (e.key === 'ArrowRight' && idx < ordered.length - 1) {
          onChapterChange(ordered[idx + 1])
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [chapterId, volumes, chapters, onChapterChange])

  // Typewriter mode: scroll cursor to center on selection change
  useEffect(() => {
    if (!editor) return
    if (typewriterMode) {
      const handler = () => {
        const { view } = editor
        const { top } = view.coordsAtPos(view.state.selection.from)
        const viewportHeight = window.innerHeight
        const scrollTarget = top - viewportHeight * 0.45
        window.scrollTo({ top: scrollTarget, behavior: 'smooth' })
      }
      editor.on('selectionUpdate', handler)
      return () => { editor.off('selectionUpdate', handler) }
    }
  }, [editor, typewriterMode])

  // Line focus: dim non-active paragraphs in typewriter mode
  useEffect(() => {
    if (!editor) return
    const el = editor.view.dom
    if (typewriterMode) {
      el.classList.add('line-focus')
    } else {
      el.classList.remove('line-focus')
    }
  }, [editor, typewriterMode])

  const scheduleSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveContent(), 1500)
  }

  const saveContent = async () => {
    if (!currentChapter || !editor || isSaving.current) return
    isSaving.current = true
    const content = editor.getHTML()
    const text = editor.state.doc.textContent
    const wordCount = [...text].filter((c) => /[一-鿿]/.test(c)).length
      + text.replace(/[一-鿿]/g, '').split(/\s+/).filter(Boolean).length
    const delta = wordCount - (currentChapter.word_count || 0)
    if (delta > 0) await recordWords(delta)
    await window.api.chapter.update(currentChapter.id, { content, word_count: wordCount } as any)
    setCurrentChapter((prev) => prev ? { ...prev, content, word_count: wordCount } : null)
    setTotalWords((prev) => prev + wordCount - (currentChapter.word_count || 0))
    isSaving.current = false
  }

  const handleCreateChapter = async (volumeId: number | null = null) => {
    const chap = await window.api.chapter.create({
      novel_id: novelId, volume_id: volumeId, title: '新章节',
    })
    await loadData()
    onChapterChange(chap.id)
  }

  const handleCreateVolume = async () => {
    const name = prompt('卷名称:')
    if (!name?.trim()) return
    await window.api.volume.create({ novel_id: novelId, title: name.trim() })
    await loadData()
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as number)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id) return

    const activeId = active.id as number
    const overId = over.id as number
    const activeChapter = chapters.find((c) => c.id === activeId)
    const overChapter = chapters.find((c) => c.id === overId)
    if (!activeChapter || !overChapter) return

    // If volumes differ, move to target volume first
    const targetVid = overChapter.volume_id
    if (activeChapter.volume_id !== targetVid) {
      await window.api.chapter.moveToVolume(activeId, targetVid)
    }

    // Build new order including the active chapter (for cross-volume moves)
    const siblingIds = chapters
      .filter((c) => c.volume_id === targetVid)
      .map((c) => c.id)
    let activeIdx = siblingIds.indexOf(activeId)
    const overIdx = siblingIds.indexOf(overId)

    if (activeIdx === -1) {
      // Cross-volume: insert active at over position
      siblingIds.splice(overIdx, 0, activeId)
    } else if (activeIdx >= 0 && overIdx >= 0 && activeIdx !== overIdx) {
      // Same-volume: remove then re-insert
      siblingIds.splice(activeIdx, 1)
      const insertAt = overIdx < activeIdx ? overIdx : overIdx - 1
      siblingIds.splice(insertAt, 0, activeId)
    }

    try {
      await window.api.chapter.reorder(siblingIds)
    } catch {
      await loadData()
      return
    }

    // Optimistic local update
    setChapters((prev) => {
      const next = prev.map((c) => ({ ...c }))
      const aIdx = next.findIndex((c) => c.id === activeId)
      const oIdx = next.findIndex((c) => c.id === overId)
      if (aIdx >= 0 && oIdx >= 0 && aIdx !== oIdx) {
        const [item] = next.splice(aIdx, 1)
        next.splice(oIdx, 0, { ...item, volume_id: targetVid })
      }
      return next
    })
  }

  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle)
    if (!currentChapter) return
    await window.api.chapter.update(currentChapter.id, { title: newTitle } as any)
    setCurrentChapter((prev) => prev ? { ...prev, title: newTitle } : null)
    await loadData()
  }

  useEffect(() => {
    const handler = (e: Event) => {
      if (editor) {
        editor.chain().focus().insertContent((e as CustomEvent).detail).run()
      }
    }
    window.addEventListener('ai-insert', handler)
    return () => window.removeEventListener('ai-insert', handler)
  }, [editor])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Chapter tree sidebar */}
        {!focusMode && (
          <div className="w-56 border-r border-border overflow-y-auto bg-card/30 shrink-0">
            <div className="p-2 flex items-center justify-between sticky top-0 bg-card/80 backdrop-blur z-10">
              <span className="text-xs font-medium text-muted-foreground">目录</span>
              <div className="flex gap-1">
                <button onClick={() => handleCreateChapter(null)} className="text-xs px-1.5 py-0.5 rounded hover:bg-accent" title="新建章节">+章</button>
                <button onClick={handleCreateVolume} className="text-xs px-1.5 py-0.5 rounded hover:bg-accent" title="新建卷">+卷</button>
              </div>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {volumes.map((vol) => {
                const volChapters = chapters.filter((c) => c.volume_id === vol.id)
                const ids = volChapters.map((c) => c.id)
                return (
                  <div key={vol.id} className="mb-1">
                    <div className="px-3 py-1 text-xs font-medium text-muted-foreground flex items-center justify-between group">
                      <span className="truncate">{vol.title}</span>
                      <button onClick={() => handleCreateChapter(vol.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                      {volChapters.map((chap) => (
                        <SortableChapterItem
                          key={chap.id}
                          chap={chap}
                          isActive={chap.id === chapterId}
                          onSelect={() => onChapterChange(chap.id)}
                        />
                      ))}
                    </SortableContext>
                  </div>
                )
              })}
              {/* Unassigned chapters */}
              {chapters.filter((c) => !c.volume_id).length > 0 && (
                <SortableContext
                  items={chapters.filter((c) => !c.volume_id).map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {chapters.filter((c) => !c.volume_id).map((chap) => (
                    <SortableChapterItem
                      key={chap.id}
                      chap={chap}
                      isActive={chap.id === chapterId}
                      onSelect={() => onChapterChange(chap.id)}
                    />
                  ))}
                </SortableContext>
              )}
              <DragOverlay>
                {activeDragId ? (
                  <div className="px-2 py-1 text-sm bg-card border border-border rounded shadow-lg opacity-80 truncate">
                    {chapters.find((c) => c.id === activeDragId)?.title ?? ''}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {/* Main editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {currentChapter ? (
            <>
              {!focusMode && (
                <div className="px-8 py-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <input
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        className="text-xl font-semibold bg-transparent outline-none w-full"
                        placeholder="章节标题"
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        {currentChapter.status === 'done' ? '已完成' : currentChapter.status === 'writing' ? '写作中' : '草稿'}
                        {' · '}{currentChapter.word_count}字
                        {' · '}更新于 {currentChapter.updated_at}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={async () => {
                          const result = await window.api.export.txt(novelId, novelTitle)
                          if (result.success) alert(`导出成功: ${result.path}`)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors"
                        title="导出 TXT"
                      >
                        <FileText className="w-3.5 h-3.5" /> TXT
                      </button>
                      <button
                        onClick={async () => {
                          const result = await window.api.export.epub(novelId, novelTitle)
                          if (result.success) alert(`导出成功: ${result.path}`)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors"
                        title="导出 EPUB"
                      >
                        <BookOpen className="w-3.5 h-3.5" /> EPUB
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Smart split prompt */}
              {currentChapter && (currentChapter.word_count || 0) > 8000 && !focusMode && (
                <div className="px-4 py-2 bg-accent/20 border-b border-border text-xs text-muted-foreground flex items-center justify-between">
                  <span>本章已超过 8000 字，建议拆分以提升编辑流畅度</span>
                  <button
                    onClick={async () => {
                      const content = editor?.getHTML() || currentChapter.content
                      const halfLen = Math.floor(content.length / 2)
                      const splitIdx = content.indexOf('</p>', halfLen)
                      const firstHalf = splitIdx > 0 ? content.slice(0, splitIdx + 4) : content.slice(0, halfLen)
                      const secondHalf = splitIdx > 0 ? content.slice(splitIdx + 4) : content.slice(halfLen)

                      await window.api.chapter.update(currentChapter.id, { content: firstHalf, word_count: Math.floor((currentChapter.word_count || 0) / 2) } as any)
                      const newChap = await window.api.chapter.create({
                        novel_id: novelId,
                        volume_id: currentChapter.volume_id,
                        title: currentChapter.title + ' (续)',
                        content: secondHalf,
                      })
                      await loadData()
                      onChapterChange(newChap.id)
                    }}
                    className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:opacity-90"
                  >
                    一键拆分
                  </button>
                </div>
              )}
              {!focusMode && <EditorToolbar editor={editor} />}
              <div className="flex-1 overflow-y-auto">
                <div className={`tiptap-editor ${focusMode ? 'max-w-3xl mx-auto pt-12' : 'max-w-4xl mx-auto'}`}>
                  <EditorContent editor={editor} />
                </div>
              </div>
              <WordCount
                editor={editor}
                manualWordCount={currentChapter.word_count}
                novelId={novelId}
                focusMode={focusMode}
                onToggleFocus={onToggleFocus}
                typewriterMode={typewriterMode}
                onToggleTypewriter={onToggleTypewriter}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="mb-2">选择一个章节或创建新章节开始写作</p>
                <button
                  onClick={() => handleCreateChapter(null)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 transition-opacity"
                >
                  创建新章节
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
