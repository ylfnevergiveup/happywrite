import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import { FileText, BookOpen, Plus } from 'lucide-react'
import Typography from '@tiptap/extension-typography'
import Link from '@tiptap/extension-link'
import { InputRule, Extension } from '@tiptap/core'
import { EditorToolbar } from './EditorToolbar'
import { WordCount } from './WordCount'
import type { Chapter, Volume } from '@/types'

const MarkdownShortcuts = Extension.create({
  name: 'markdownShortcuts',
  addInputRules() {
    return [
      // Blockquote: "> " at start of paragraph
      new InputRule({
        find: /^>\s$/,
        handler: ({ state, range }) => {
          state.tr
            .delete(range.from, range.to)
            .setBlockType(range.from, range.from, state.schema.nodes.blockquote)
        },
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
      // Bullet list: "- " at start of paragraph
      new InputRule({
        find: /^-\s$/,
        handler: ({ state, range }) => {
          state.tr
            .delete(range.from, range.to)
            .setBlockType(range.from, range.from, state.schema.nodes.bulletList)
        },
      }),
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
        // In a paragraph: insert 2 non-breaking spaces at cursor
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
            this.editor.chain().focus().setLink({ href: url }).run()
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

interface Props {
  novelId: number
  chapterId: number | null
  onChapterChange: (id: number) => void
  onTextSelect: (text: string) => void
  focusMode: boolean
  onToggleFocus: () => void
}

export function NovelEditor({ novelId, chapterId, onChapterChange, onTextSelect, focusMode, onToggleFocus }: Props) {
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [chapters, setChapters] = useState<(Chapter & { volume_title?: string })[]>([])
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null)
  const [title, setTitle] = useState('')
  const [totalWords, setTotalWords] = useState(0)
  const [novelTitle, setNovelTitle] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const isSaving = useRef(false)

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

  // Listen for search navigation
  useEffect(() => {
    const handler = (e: Event) => {
      const { chapterId: targetId } = (e as CustomEvent).detail
      if (targetId) onChapterChange(targetId)
    }
    window.addEventListener('navigate-chapter', handler)
    return () => window.removeEventListener('navigate-chapter', handler)
  }, [onChapterChange])

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
            {volumes.map((vol) => (
              <div key={vol.id} className="mb-1">
                <div className="px-3 py-1 text-xs font-medium text-muted-foreground flex items-center justify-between group">
                  <span className="truncate">{vol.title}</span>
                  <button onClick={() => handleCreateChapter(vol.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {chapters.filter((c) => c.volume_id === vol.id).map((chap) => (
                  <button
                    key={chap.id}
                    onClick={() => onChapterChange(chap.id)}
                    className={`w-full text-left px-4 py-1 text-sm hover:bg-accent transition-colors truncate block
                      ${chap.id === chapterId ? 'bg-accent text-primary font-medium' : 'text-foreground'}`}
                  >
                    {chap.title}
                    <span className="text-xs text-muted-foreground ml-1">({chap.word_count}字)</span>
                  </button>
                ))}
              </div>
            ))}
            {chapters.filter((c) => !c.volume_id).map((chap) => (
              <button
                key={chap.id}
                onClick={() => onChapterChange(chap.id)}
                className={`w-full text-left px-3 py-1 text-sm hover:bg-accent transition-colors truncate block
                  ${chap.id === chapterId ? 'bg-accent text-primary font-medium' : 'text-foreground'}`}
              >
                {chap.title}
                <span className="text-xs text-muted-foreground ml-1">({chap.word_count}字)</span>
              </button>
            ))}
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
              {!focusMode && <EditorToolbar editor={editor} />}
              <div className="flex-1 overflow-y-auto">
                <div className={`tiptap-editor ${focusMode ? 'max-w-3xl mx-auto pt-12' : 'max-w-4xl mx-auto'}`}>
                  <EditorContent editor={editor} />
                </div>
              </div>
              <WordCount editor={editor} manualWordCount={currentChapter.word_count} novelId={novelId} focusMode={focusMode} onToggleFocus={onToggleFocus} />
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
