import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Sparkles, X, Copy, ChevronDown, NotepadText, GitBranch, Plus, Trash2, History, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OutlineTree } from '../OutlineManager/OutlineTree'
import { StyleSkillManager } from './StyleSkillManager'

type Tab = 'ai' | 'notes' | 'outline' | 'style'
type AIMode = 'continue' | 'polish' | 'inspire' | 'character' | 'outline' | 'review' | 'summarize'

interface Session {
  id: number
  novel_id: number
  chapter_id: number | null
  context_type: string
  messages: string
  title: string
  created_at: string
}

const modeLabels: Record<AIMode, string> = {
  continue: '续写', polish: '润色', inspire: '灵感', character: '人物', outline: '大纲',
  review: '审稿', summarize: '摘要',
}

const modePrompts: Record<AIMode, string> = {
  continue: '请根据上下文自然地续写接下来的内容，保持一致的文风和节奏。',
  polish: '请润色以下文字，修正语法错误，优化表达，但保留原意和风格：',
  inspire: '基于当前故事，生成3个可能的情节发展方向，每个包含简要说明：',
  character: '为故事生成一个新的人物设定，包括姓名、性格、背景和动机：',
  outline: '基于当前章节，建议下一章节的大纲，包括主要情节点：',
  review: `请对以下章节进行全面审稿，从以下几个维度给出具体建议：
1. 节奏把控：情节推进是否太快或太慢
2. 人物一致性：角色行为是否符合设定
3. 情节逻辑：有无矛盾或不合理之处
4. 表达优化：有哪些句子可以写得更好
5. 总体评价：本章的亮点和可改进之处`,
  summarize: '请阅读以下章节内容，用200字以内的篇幅概括本章的核心情节和关键转折，保持简洁有力：',
}

interface Props {
  novelId: number
  chapterId: number | null
  selectedText: string
  onClose: () => void
  onInsert: (text: string) => void
}

export function RightPanel({ novelId, chapterId, selectedText, onClose, onInsert }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('ai')
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<AIMode>('continue')
  const [chapterNotes, setChapterNotes] = useState('')
  const [injectContext, setInjectContext] = useState(true)
  const notesTimer = useRef<ReturnType<typeof setTimeout>>()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [styleSkills, setStyleSkills] = useState<Array<{ id: number; name: string; is_default: number }>>([])
  const [styleSkillId, setStyleSkillId] = useState<number | null>(null)

  // Session state
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [showSessionMenu, setShowSessionMenu] = useState(false)

  // Load chapter notes when chapter changes
  useEffect(() => {
    if (chapterId) {
      window.api.chapterNote.get(chapterId).then(setChapterNotes)
    } else {
      setChapterNotes('')
    }
  }, [chapterId])

  // Load sessions & context preference
  useEffect(() => {
    window.api.ai.getSessions(novelId).then((list: Session[]) => setSessions(list))
    window.api.setting.get('ai_inject_context').then((v) => {
      if (v !== null) setInjectContext(v as boolean)
    })
  }, [novelId])

  // Load style skills
  useEffect(() => {
    if (activeTab !== 'ai') return
    window.api.style.list(novelId).then((list) => {
      setStyleSkills(list)
      const def = list.find((s) => s.is_default === 1)
      if (def) setStyleSkillId(def.id)
    })
  }, [novelId, activeTab])

  // Save notes with debounce
  const saveNotes = (value: string) => {
    setChapterNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      if (chapterId) {
        await window.api.chapterNote.update(chapterId, value)
      }
    }, 500)
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const getSettings = async () => {
    const apiKey = await window.api.setting.get('ai_api_key') as string
    const model = await window.api.setting.get('ai_model') as string
    const baseUrl = await window.api.setting.get('ai_base_url') as string
    const provider = await window.api.setting.get('ai_provider') as string
    return { apiKey, model: model || 'deepseek-chat', baseUrl, provider: (provider || 'deepseek') as string }
  }

  const loadSession = async (id: number) => {
    const session = await window.api.ai.getSession(id) as Session | undefined
    if (session) {
      try {
        const msgs = JSON.parse(session.messages) as Array<{ role: string; content: string }>
        setMessages(msgs)
        setSessionId(session.id)
      } catch { /* corrupted session */ }
    }
  }

  const deleteSession = async (id: number) => {
    await window.api.ai.deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (sessionId === id) {
      setSessionId(null)
      setMessages([])
    }
  }

  const handleNewSession = () => {
    setSessionId(null)
    setMessages([])
    setShowSessionMenu(false)
  }

  const saveCurrentSession = useCallback(async (msgs: Array<{ role: string; content: string }>, sid: number | null) => {
    const messagesJson = JSON.stringify(msgs)
    // Auto-generate title from first user message
    const firstUserMsg = msgs.find((m) => m.role === 'user')
    const autoTitle = firstUserMsg ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '') : ''

    if (sid) {
      await window.api.ai.updateSession(sid, { messages: messagesJson })
    } else {
      const newId = await window.api.ai.saveSession({
        novel_id: novelId,
        chapter_id: chapterId,
        context_type: mode,
        messages: messagesJson,
        title: autoTitle,
      })
      setSessionId(newId)
      setSessions((prev) => [{ id: newId, novel_id: novelId, chapter_id: chapterId, context_type: mode, messages: messagesJson, title: autoTitle, created_at: new Date().toISOString() }, ...prev])
    }
  }, [novelId, chapterId, mode])

  const handleSend = async () => {
    const { apiKey, model, baseUrl, provider } = await getSettings()
    if (!apiKey) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '请先在设置中配置 AI API Key。' }])
      return
    }

    // Build user message based on mode
    let userMessage: string
    if (mode === 'review' || mode === 'summarize') {
      // Fetch full chapter content
      let chapterContent = ''
      if (chapterId) {
        const ch = await window.api.chapter.get(chapterId)
        if (ch) {
          chapterContent = `标题：${ch.title}\n\n${ch.content}`
        }
      }
      if (!chapterContent.trim()) {
        setMessages((prev) => [...prev, { role: 'assistant', content: '当前没有可用的章节内容。请先打开一个章节。' }])
        return
      }
      userMessage = `${modePrompts[mode]}\n\n${chapterContent}`
    } else {
      userMessage = input.trim()
        ? `${modePrompts[mode]}\n\n${selectedText ? `选中的文字：${selectedText}\n\n` : ''}${input}`
        : modePrompts[mode] + (selectedText ? `\n\n选中的文字：${selectedText}` : '\n\n请根据上下文提供建议。')
    }

    // Build context if enabled
    let contextPrefix = ''
    if (injectContext) {
      try {
        const ctx = await window.api.ai.buildContext(novelId, chapterId)
        if (ctx) {
          contextPrefix = `以下是小说的创作背景信息，请在回答时充分利用这些设定：\n\n${ctx}\n\n---\n\n`
        }
      } catch { /* context fetch failed, proceed without */ }
    }

    const systemMessage = contextPrefix
      ? `你是一位专业的网文写作助手，擅长中文文学创作。你的回答应该简洁、实用、有创意。\n\n${contextPrefix}`
      : '你是一位专业的网文写作助手，擅长中文文学创作。你的回答应该简洁、实用、有创意。'

    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await window.api.ai.sendMessage({
        messages: [
          { role: 'system', content: systemMessage },
          ...newMessages,
        ],
        apiKey, model, baseUrl, provider,
        styleSkillId: styleSkillId ?? undefined,
      })
      const finalMessages = [...newMessages, { role: 'assistant', content: response }]
      setMessages(finalMessages)
      // Auto-save to session
      saveCurrentSession(finalMessages, sessionId)
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `AI 请求失败：${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const toggleContext = async () => {
    const next = !injectContext
    setInjectContext(next)
    await window.api.setting.set('ai_inject_context', next)
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Sparkles }> = [
    { id: 'ai', label: 'AI 助手', icon: Sparkles },
    { id: 'notes', label: '笔记', icon: NotepadText },
    { id: 'outline', label: '大纲', icon: GitBranch },
    { id: 'style', label: '风格', icon: Palette },
  ]

  return (
    <aside className="w-96 border-l border-border bg-card flex flex-col shrink-0 animate-slide-in-right">
      {/* Header with tabs */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between px-3 pt-2">
          <div className="flex gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t border border-b-0 transition-colors',
                  activeTab === tab.id
                    ? 'bg-background text-primary border-border'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Tab */}
      {activeTab === 'ai' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Session bar */}
          <div className="px-3 py-2 border-b border-border flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="relative flex-1">
              <button
                onClick={() => setShowSessionMenu(!showSessionMenu)}
                className="flex items-center justify-between w-full text-xs px-2 py-1 rounded border border-border hover:bg-accent truncate"
              >
                <span className="truncate">
                  {sessionId
                    ? (sessions.find((s) => s.id === sessionId)?.title || '未命名会话')
                    : '新会话'}
                </span>
                <ChevronDown className="w-3 h-3 shrink-0 ml-1" />
              </button>
              {showSessionMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded shadow-lg z-20 max-h-48 overflow-y-auto">
                  <button
                    onClick={handleNewSession}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-1.5 text-primary"
                  >
                    <Plus className="w-3 h-3" /> 新会话
                  </button>
                  <div className="border-t border-border" />
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-center group">
                      <button
                        onClick={() => { loadSession(s.id); setShowSessionMenu(false) }}
                        className={cn(
                          'flex-1 text-left px-3 py-1.5 text-xs hover:bg-accent truncate',
                          s.id === sessionId && 'text-primary bg-accent/50'
                        )}
                      >
                        {s.title || `会话 ${s.id}`}
                        <span className="text-muted-foreground ml-1 text-[10px]">
                          {s.created_at?.slice(0, 10)}
                        </span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-accent rounded shrink-0 mr-1"
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">暂无历史会话</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mode selector */}
          <div className="px-3 py-2 border-b border-border">
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(modeLabels) as [AIMode, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    mode === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {(key === 'review' || key === 'summarize') && (
                    <span className="mr-0.5">{key === 'review' ? '✨' : '📋'}</span>
                  )}
                  {label}
                </button>
              ))}
            </div>
            {selectedText && mode !== 'review' && mode !== 'summarize' && (
              <p className="text-xs text-muted-foreground mt-1.5 truncate">
                已选中: {selectedText.slice(0, 30)}...
              </p>
            )}
            {(mode === 'review' || mode === 'summarize') && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {mode === 'review' ? '将对当前章节全文进行审稿分析' : '将为当前章节生成内容摘要'}
              </p>
            )}
          </div>

          {/* Style selector */}
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">风格</span>
              <select
                value={styleSkillId ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  setStyleSkillId(val ? parseInt(val) : null)
                }}
                className="flex-1 text-xs bg-background border border-border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">无风格</option>
                {styleSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.is_default === 1 ? ' ⭐' : ''}
                  </option>
                ))}
              </select>
            </div>
            {styleSkillId && styleSkills.length > 0 && (
              <p className="text-[10px] text-primary mt-1">
                📌 已注入"{styleSkills.find((s) => s.id === styleSkillId)?.name}"风格到 system prompt
              </p>
            )}
          </div>

          {/* Context toggle */}
          <div className="px-3 py-1.5 border-b border-border flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={injectContext}
                onChange={toggleContext}
                className="accent-primary w-3 h-3"
              />
              注入创作上下文
            </label>
            <span className="text-[10px] text-muted-foreground/60" title="将角色、世界观、大纲等设定自动附加到 AI 请求中，让回复更贴合故事">
              角色 · 世界观 · 大纲
            </span>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground mt-8">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary/40" />
                <p>选择模式并发送消息</p>
                <p className="text-xs mt-1">AI 可以帮你续写、润色、审稿、生成摘要等</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn(
                'text-sm rounded-lg p-2.5 max-w-full',
                msg.role === 'user' ? 'bg-primary/10 ml-4' : 'bg-accent mr-2'
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => onInsert(msg.content)}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Copy className="w-3 h-3" /> 插入编辑器
                    </button>
                    {mode === 'summarize' && (
                      <button
                        onClick={() => {
                          saveNotes(msg.content)
                          // Also show a brief confirmation
                          const el = document.activeElement as HTMLElement
                          el?.blur()
                        }}
                        className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
                      >
                        <NotepadText className="w-3 h-3" /> 保存到笔记
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 正在{mode === 'review' ? '审稿' : mode === 'summarize' ? '生成摘要' : '生成'}...
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={
                  mode === 'review' ? '点击发送即开始审稿（自动读取全文）...' :
                  mode === 'summarize' ? '点击发送即生成摘要（自动读取全文）...' :
                  '输入指令或直接发送...'
                }
                className="flex-1 text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="p-2 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <span className="text-sm font-medium flex items-center gap-2">
              <NotepadText className="w-4 h-4 text-primary" />
              章节笔记
            </span>
          </div>
          <textarea
            value={chapterNotes}
            onChange={(e) => saveNotes(e.target.value)}
            className="flex-1 p-4 text-sm bg-transparent outline-none resize-none"
            placeholder="随手记下本章的想法、待修改点、灵感碎片..."
          />
        </div>
      )}

      {/* Outline Tab */}
      {activeTab === 'outline' && (
        <div className="flex-1 overflow-y-auto p-3">
          <OutlineTree novelId={novelId} compact />
        </div>
      )}

      {/* Style Tab */}
      {activeTab === 'style' && (
        <StyleSkillManager novelId={novelId} />
      )}
    </aside>
  )
}
