import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import { FileText, BookOpen, Plus, GripVertical, Trash2, Sparkles, Shield, BarChart3, History, ChevronDown, MoreHorizontal } from 'lucide-react'
import Typography from '@tiptap/extension-typography'
import Link from '@tiptap/extension-link'
import { InputRule, wrappingInputRule, Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { EditorToolbar } from './EditorToolbar'
import { WordCount } from './WordCount'
import { BookAnalyzer } from './BookAnalyzer'
import { SensitiveWordChecker } from './SensitiveWordChecker'
import { WordRepetitionPanel } from './WordRepetitionPanel'
import { ChapterHistory } from './ChapterHistory'
import { ExportDialog } from './ExportDialog'
import { AIFloatPanel } from './AIFloatPanel'
import { ChapterRhythm } from './ChapterRhythm'
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

// ── Active line plugin for typewriter line focus ────────

const activeLineKey = new PluginKey('activeLine')

function activeLinePlugin() {
  return new Plugin({
    key: activeLineKey,
    props: {
      decorations(state) {
        const { $from } = state.selection
        const pos = $from.pos
        const resolved = state.doc.resolve(pos)
        const depth = resolved.depth
        let targetDepth = depth
        // Walk up to find the paragraph-level node
        while (targetDepth > 0 && resolved.node(targetDepth).type.name !== 'paragraph') {
          targetDepth--
        }
        if (targetDepth === 0) return DecorationSet.empty

        const parent = resolved.node(targetDepth)
        if (parent.type.name === 'paragraph') {
          const from = resolved.before(targetDepth)
          const to = resolved.after(targetDepth)
          const deco = Decoration.node(from, to, {
            'data-active-line': 'true',
          })
          return DecorationSet.create(state.doc, [deco])
        }
        return DecorationSet.empty
      },
    },
  })
}

// ── Chapter templates ────────────────────────────────────

interface ChapterTemplate {
  name: string
  description: string
  content: string
}

const CHAPTER_TEMPLATES: ChapterTemplate[] = [
  {
    name: '空白章节',
    description: '从头开始写作',
    content: '',
  },
  {
    name: '三幕结构',
    description: '开端→对抗→结局',
    content: '## 第一幕：开端\n\n（介绍主角、世界观和核心冲突的萌芽）\n\n---\n\n## 第二幕：对抗\n\n（冲突升级，主角面临困难和选择，成长蜕变）\n\n---\n\n## 第三幕：结局\n\n（冲突达到高潮并解决，主角达成目标或领悟真谛）\n',
  },
  {
    name: '起承转合',
    description: '引入→发展→转折→收束',
    content: '## 起\n\n（引入场景和人物，铺垫氛围和矛盾）\n\n## 承\n\n（事件发展，关系深化，暗流涌动）\n\n## 转\n\n（突发变故，矛盾激化，高潮迭起）\n\n## 合\n\n（尘埃落定，余韵悠长）\n',
  },
  {
    name: '悬念开篇',
    description: '用悬念/冲突/对话直接抓人',
    content: '## 引子\n\n（一个令人好奇的场景/对话/事件，直接抛出悬念）\n\n---\n\n## 展开\n\n（逐步揭示背景和人物动机，推动情节）\n',
  },
  {
    name: '日常铺垫',
    description: '温馨日常中埋下伏笔',
    content: '## 平凡日常\n\n（展示角色的日常生活，建立读者共鸣）\n\n## 微澜\n\n（日常中出现小小的不寻常，埋下伏笔）\n\n## 暗流\n\n（暗示更大的事件即将到来）\n',
  },
]

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft:    { color: 'bg-gray-400',   label: '草稿' },
  writing:  { color: 'bg-blue-500',   label: '写作中' },
  revising: { color: 'bg-amber-500',  label: '修改中' },
  done:     { color: 'bg-green-500',  label: '已完成' },
}

function SortableChapterItem({ chap, isActive, onSelect, onDelete }: {
  chap: Chapter & { volume_title?: string }
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
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
        data-chapter-id={chap.id}
        className={`flex-1 text-left px-2 py-1 text-sm hover:bg-accent transition-colors truncate flex items-center gap-1.5
          ${isActive ? 'bg-accent text-primary font-medium' : 'text-foreground'}`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_CONFIG[chap.status]?.color || 'bg-gray-400'}`} />
        <span className="truncate">{chap.title}</span>
        <span className="text-xs text-muted-foreground ml-1 shrink-0">({chap.word_count}字)</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="p-0.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        title="删除章节">
        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
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
  splitMode?: boolean
  onToggleSplitMode?: () => void
  syncState?: 'idle' | 'syncing' | 'success' | 'error'
  lastSyncAt?: string | null
  onSync?: () => void
}

export function NovelEditor({ novelId, chapterId, onChapterChange, onTextSelect, focusMode, onToggleFocus, typewriterMode, onToggleTypewriter, splitMode, onToggleSplitMode, syncState, lastSyncAt, onSync }: Props) {
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [chapters, setChapters] = useState<(Chapter & { volume_title?: string })[]>([])
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null)
  const [title, setTitle] = useState('')
  const [totalWords, setTotalWords] = useState(0)
  const [novelTitle, setNovelTitle] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const isSaving = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [activeDragId, setActiveDragId] = useState<number | null>(null)
  const [addingVolume, setAddingVolume] = useState(false)
  const [newVolumeName, setNewVolumeName] = useState('')
  const [showFloatPanel, setShowFloatPanel] = useState(false)
  const [floatPanelPos, setFloatPanelPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const floatPanelTextRef = useRef('')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [pendingVolumeId, setPendingVolumeId] = useState<number | null>(null)
  const [showBookAnalyzer, setShowBookAnalyzer] = useState(false)
  const [showSensitiveChecker, setShowSensitiveChecker] = useState(false)
  const [showWordRep, setShowWordRep] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showRhythm, setShowRhythm] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [collapsedVolumes, setCollapsedVolumes] = useState<Set<number>>(new Set())
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const chapterTreeRef = useRef<HTMLDivElement>(null)

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
      Extension.create({
        name: 'activeLine',
        addProseMirrorPlugins() {
          return [activeLinePlugin()]
        },
      }),
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

  // Track previous chapter ID to save before switching
  const prevChapterRef = useRef<number | null>(null)

  // Load chapter when selected
  useEffect(() => {
    if (!chapterId || chapters.length === 0) return
    const loadChapter = async () => {
      // Save current chapter content before switching
      if (prevChapterRef.current && prevChapterRef.current !== chapterId && currentChapter) {
        if (editor && isSaving.current === false) {
          const content = editor.getHTML()
          const text = editor.state.doc.textContent
          const wordCount = [...text].filter((c) => /[一-鿿]/.test(c)).length
            + text.replace(/[一-鿿]/g, '').split(/\s+/).filter(Boolean).length
          await window.api.chapter.update(currentChapter.id, { content, word_count: wordCount } as any)
        }
      }
      prevChapterRef.current = chapterId

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

  // Close menus on click outside
  useEffect(() => {
    if (!showStatusMenu && !showMoreMenu) return
    const handler = (e: MouseEvent) => {
      if (showStatusMenu && statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false)
      }
      if (showMoreMenu && moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showStatusMenu, showMoreMenu])

  // Auto-scroll chapter tree to current chapter
  useEffect(() => {
    if (!chapterId || !chapterTreeRef.current) return
    const el = chapterTreeRef.current.querySelector(`[data-chapter-id="${chapterId}"]`)
    if (el) {
      // Expand the volume containing this chapter if collapsed
      const chapter = chapters.find(c => c.id === chapterId)
      if (chapter?.volume_id && collapsedVolumes.has(chapter.volume_id)) {
        const next = new Set(collapsedVolumes)
        next.delete(chapter.volume_id)
        setCollapsedVolumes(next)
      }
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [chapterId])

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
    if (!editor || !typewriterMode) return
    let rafId: number | null = null
    const handler = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const { view } = editor
        const $pos = view.state.selection.$from
        const dom = view.domAtPos($pos.pos)
        const el = dom.node.nodeType === 3
          ? dom.node.parentElement
          : dom.node as HTMLElement
        el?.scrollIntoView({ block: 'center', behavior: 'instant' })
      })
    }
    editor.on('selectionUpdate', handler)
    return () => {
      editor.off('selectionUpdate', handler)
      if (rafId !== null) cancelAnimationFrame(rafId)
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


  // Mouseup listener: open AI float panel on text selection
  useEffect(() => {
    if (!editor) return
    const el = editor.view.dom
    let timer: ReturnType<typeof setTimeout>
    const handler = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const { from, to } = editor.state.selection
        if (from === to) return
        const text = editor.state.doc.textBetween(from, to, ' ')
        if (!text.trim()) return
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) return
        const rect = sel.getRangeAt(0).getBoundingClientRect()
        if (!rect || (rect.top === 0 && rect.left === 0)) return
        floatPanelTextRef.current = text
        setFloatPanelPos({
          top: rect.bottom + window.scrollY,
          left: rect.left + rect.width / 2 + window.scrollX,
        })
        setShowFloatPanel(true)
      }, 300)
    }
    el.addEventListener('mouseup', handler)
    return () => {
      el.removeEventListener('mouseup', handler)
      clearTimeout(timer)
    }
  }, [editor])

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
    // Save history snapshot (debounced: every 5 minutes)
    saveHistoryThrottled(currentChapter.id, currentChapter.title, content, wordCount)
  }

  const historyTimer = useRef<ReturnType<typeof setTimeout>>()
  const saveHistoryThrottled = (chapterId: number, title: string, content: string, wordCount: number) => {
    if (historyTimer.current) clearTimeout(historyTimer.current)
    historyTimer.current = setTimeout(() => {
      window.api.chapter.saveHistory(chapterId, title, content, wordCount)
    }, 300000) // 5 min debounce
  }

  // ── Float panel handlers ─────────────────────────────────

  const handleFloatPanelOpen = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return
    const text = editor.state.doc.textBetween(from, to, ' ')
    if (!text.trim()) return

    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    if (!rect || (rect.top === 0 && rect.left === 0)) return

    floatPanelTextRef.current = text
    setFloatPanelPos({
      top: rect.bottom + window.scrollY,
      left: rect.left + rect.width / 2 + window.scrollX,
    })
    setShowFloatPanel(true)
  }, [editor])

  const handleFloatReplace = useCallback((html: string) => {
    if (!editor) return
    editor.chain().focus().deleteSelection().insertContent(html).run()
  }, [editor])

  const handleFloatInsertAfter = useCallback((html: string) => {
    if (!editor) return
    editor.chain().focus().setTextSelection(editor.state.selection.to).insertContent(html).run()
  }, [editor])

  // ── Chapter creation with template ─────────────────────

  const handleCreateChapter = async (volumeId: number | null = null) => {
    setPendingVolumeId(volumeId)
    setShowTemplatePicker(true)
  }

  const handleCreateChapterWithTemplate = async (template: ChapterTemplate) => {
    setShowTemplatePicker(false)
    try {
      const volumeId = pendingVolumeId
      const title = template.name === '空白章节' ? '新章节' : template.name
      const chap = await window.api.chapter.create({
        novel_id: novelId, volume_id: volumeId, title, content: template.content,
      })
      await loadData()
      onChapterChange(chap.id)
    } catch (e: any) {
      alert('创建章节失败: ' + (e?.message ?? String(e)))
    }
  }

  const handleDeleteChapter = async (id: number) => {
    if (!confirm('确定删除此章节？')) return
    await window.api.chapter.delete(id)
    if (id === chapterId) {
      setCurrentChapter(null)
    }
    await loadData()
  }

  const handleCreateVolume = () => {
    setAddingVolume(true)
    setNewVolumeName('')
  }

  const confirmCreateVolume = async () => {
    const name = newVolumeName.trim()
    if (!name) {
      setAddingVolume(false)
      return
    }
    try {
      await window.api.volume.create({ novel_id: novelId, title: name })
      await loadData()
    } catch (e: any) {
      alert('创建卷失败: ' + (e?.message ?? String(e)))
    }
    setAddingVolume(false)
    setNewVolumeName('')
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
        const text = (e as CustomEvent).detail as string
        // Convert plain text \n\n paragraph breaks to proper HTML <p> tags
        // so paragraphs are preserved after save/reload
        const html = text
          .split(/\n\n+/)
          .map((p: string) => p.trim())
          .filter(Boolean)
          .map((p: string) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('')
        editor.chain().focus().insertContent(html).run()
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
          <div ref={chapterTreeRef} className="w-56 border-r border-border overflow-y-auto bg-card/30 shrink-0">
            <div className="p-2 flex items-center justify-between sticky top-0 bg-card/80 backdrop-blur z-10">
              <span className="text-xs font-medium text-muted-foreground">目录</span>
              <div className="flex gap-1">
                <button onClick={() => handleCreateChapter(null)} className="text-xs px-1.5 py-0.5 rounded hover:bg-accent" title="新建章节">+章</button>
                <button onClick={handleCreateVolume} className="text-xs px-1.5 py-0.5 rounded hover:bg-accent" title="新建卷">+卷</button>
              </div>
            </div>
            {addingVolume && (
              <div className="px-2 py-1.5 border-b border-border bg-accent/20">
                <input
                  autoFocus
                  className="w-full text-xs px-2 py-1 rounded border border-border bg-background"
                  placeholder="输入卷名称，回车确认"
                  value={newVolumeName}
                  onChange={(e) => setNewVolumeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmCreateVolume()
                    if (e.key === 'Escape') setAddingVolume(false)
                  }}
                  onBlur={() => setAddingVolume(false)}
                />
              </div>
            )}
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
                    <button
                      onClick={() => {
                        const next = new Set(collapsedVolumes)
                        if (next.has(vol.id)) next.delete(vol.id)
                        else next.add(vol.id)
                        setCollapsedVolumes(next)
                      }}
                      className="px-3 py-1 text-xs font-medium text-muted-foreground flex items-center justify-between group w-full hover:bg-accent/50 transition-colors"
                    >
                      <span className="flex items-center gap-1 truncate">
                        <ChevronDown className={`w-3 h-3 transition-transform ${collapsedVolumes.has(vol.id) ? '-rotate-90' : ''}`} />
                        {vol.title}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCreateChapter(vol.id) }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </button>
                    {!collapsedVolumes.has(vol.id) && (
                      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                        {volChapters.map((chap) => (
                          <SortableChapterItem
                            key={chap.id}
                            chap={chap}
                            isActive={chap.id === chapterId}
                            onSelect={() => onChapterChange(chap.id)}
                            onDelete={() => handleDeleteChapter(chap.id)}
                          />
                        ))}
                      </SortableContext>
                    )}
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
                      onDelete={() => handleDeleteChapter(chap.id)}
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
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <div className="relative" ref={statusMenuRef}>
                          <button
                            onClick={() => setShowStatusMenu(!showStatusMenu)}
                            className="flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors"
                          >
                            <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[currentChapter.status]?.color || 'bg-gray-400'}`} />
                            <span>{STATUS_CONFIG[currentChapter.status]?.label || '草稿'}</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          {showStatusMenu && (
                            <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-30 py-1 min-w-[120px]">
                              {Object.entries(STATUS_CONFIG).map(([key, { color, label }]) => (
                                <button
                                  key={key}
                                  onClick={async () => {
                                    setShowStatusMenu(false)
                                    await window.api.chapter.update(currentChapter.id, { status: key } as any)
                                    setCurrentChapter(prev => prev ? { ...prev, status: key } : null)
                                    setChapters(prev => prev.map(c => c.id === currentChapter.id ? { ...c, status: key } : c))
                                  }}
                                  className={`flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-accent transition-colors text-xs
                                    ${currentChapter.status === key ? 'bg-accent font-medium' : ''}`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${color}`} />
                                  <span>{label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <span>·</span>
                        <span>{currentChapter.word_count}字</span>
                        <span>·</span>
                        <span>更新于 {currentChapter.updated_at}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setShowExport(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors"
                        title="导出"
                      >
                        <FileText className="w-3.5 h-3.5" /> 导出
                      </button>
                      <div className="relative" ref={moreMenuRef}>
                        <button
                          onClick={() => setShowMoreMenu(!showMoreMenu)}
                          className="flex items-center gap-1 px-2 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors"
                          title="更多工具"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {showMoreMenu && (
                          <div className="absolute top-full right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-30 py-1 min-w-[130px]">
                            <button
                              onClick={() => { setShowMoreMenu(false); setShowBookAnalyzer(true) }}
                              className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-accent transition-colors text-xs"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-primary" /> AI 拆书分析
                            </button>
                            <button
                              onClick={() => { setShowMoreMenu(false); setShowSensitiveChecker(true) }}
                              className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-accent transition-colors text-xs"
                            >
                              <Shield className="w-3.5 h-3.5" /> 敏感词检测
                            </button>
                            <button
                              onClick={() => { setShowMoreMenu(false); setShowWordRep(true) }}
                              className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-accent transition-colors text-xs"
                            >
                              <BarChart3 className="w-3.5 h-3.5" /> 重复词分析
                            </button>
                            <button
                              onClick={() => { setShowMoreMenu(false); setShowRhythm(true) }}
                              className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-accent transition-colors text-xs"
                            >
                              <BarChart3 className="w-3.5 h-3.5" /> 章节节奏
                            </button>
                            <button
                              onClick={() => { setShowMoreMenu(false); setShowHistory(true) }}
                              className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-accent transition-colors text-xs"
                            >
                              <History className="w-3.5 h-3.5" /> 历史版本
                            </button>
                          </div>
                        )}
                      </div>
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
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
                <div className={`tiptap-editor ${focusMode ? 'max-w-3xl mx-auto pt-12' : 'max-w-4xl mx-auto'}`}>
                  {editor && (
                    <BubbleMenu editor={editor} tippyOptions={{ duration: 150, placement: 'top' }}
                      className="flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-xl px-1 py-1">
                      <button
                        onClick={handleFloatPanelOpen}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded hover:bg-accent text-primary font-medium"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI 助手
                      </button>
                    </BubbleMenu>
                  )}
                  <EditorContent editor={editor} />
                </div>
              </div>
              <WordCount
                editor={editor}
                manualWordCount={currentChapter.word_count}
                novelId={novelId}
                focusMode={focusMode}
                onToggleFocus={onToggleFocus}
                syncState={syncState}
                lastSyncAt={lastSyncAt}
                onSync={onSync}
                typewriterMode={typewriterMode}
                onToggleTypewriter={onToggleTypewriter}
                splitMode={splitMode}
                onToggleSplitMode={onToggleSplitMode}
                wordTarget={currentChapter.word_target ?? 0}
                onUpdateWordTarget={async (target: number) => {
                  await window.api.chapter.update(currentChapter.id, { word_target: target } as any)
                  setCurrentChapter(prev => prev ? { ...prev, word_target: target } : null)
                }}
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

        {/* Book Analyzer */}
        {showBookAnalyzer && (
          <BookAnalyzer novelId={novelId} onClose={() => setShowBookAnalyzer(false)} />
        )}

        {showRhythm && (
          <div className="absolute inset-0 z-40 bg-background">
            <ChapterRhythm
              novelId={novelId}
              onSelectChapter={(id) => { onChapterChange(id); setShowRhythm(false) }}
              onClose={() => setShowRhythm(false)}
            />
          </div>
        )}

        {/* Export Dialog */}
        {showExport && (
          <ExportDialog novelId={novelId} novelTitle={novelTitle} onClose={() => setShowExport(false)} />
        )}

        {/* Sensitive Word Checker */}
        {showSensitiveChecker && editor && (
          <SensitiveWordChecker
            content={editor.state.doc.textContent}
            onReplace={() => {}}
            onClose={() => setShowSensitiveChecker(false)}
          />
        )}

        {/* Word Repetition Panel */}
        {showWordRep && editor && (
          <WordRepetitionPanel
            content={editor.state.doc.textContent}
            onClose={() => setShowWordRep(false)}
          />
        )}

        {/* Chapter History */}
        {showHistory && chapterId && (
          <ChapterHistory
            chapterId={chapterId}
            chapterTitle={currentChapter?.title || ''}
            onRestore={async () => { await loadData(); onChapterChange(chapterId) }}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/* Chapter template picker */}
        {showTemplatePicker && (
          <>
            <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowTemplatePicker(false)} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl p-5 w-[440px]" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-sm mb-1">选择章节模板</h3>
              <p className="text-xs text-muted-foreground mb-4">为新建章节选择一个结构模板</p>
              <div className="grid grid-cols-1 gap-2 max-h-[360px] overflow-y-auto">
                {CHAPTER_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    onClick={() => handleCreateChapterWithTemplate(tpl)}
                    className="text-left p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{tpl.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{tpl.description}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowTemplatePicker(false)}
                className="mt-4 w-full py-2 border border-border rounded-md text-sm hover:bg-accent"
              >
                取消
              </button>
            </div>
          </>
        )}

      </div>

      {showFloatPanel && editor && (
        <AIFloatPanel
          selectedText={floatPanelTextRef.current}
          position={floatPanelPos}
          onClose={() => setShowFloatPanel(false)}
          onReplace={handleFloatReplace}
          onInsertAfter={handleFloatInsertAfter}
        />
      )}
    </div>
  )
}
