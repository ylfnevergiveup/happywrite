import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Sparkles, X, Copy, ChevronDown, NotepadText, GitBranch, Plus, Trash2, History, Palette, Square, ArrowDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OutlineTree } from '../OutlineManager/OutlineTree'
import { StyleSkillManager } from './StyleSkillManager'
import { WriterProfile, buildPersonaPrompt } from './WriterProfile'
import { SlashCommandMenu } from './SlashCommandMenu'
import { useAISettings } from '@/hooks/useAISettings'

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
  const [writerProfile, setWriterProfile] = useState<any>(null)
  const [showWriterProfile, setShowWriterProfile] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const streamCleanupRef = useRef<(() => void) | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
    window.api.setting.get('writer_profile').then((v) => {
      if (v) setWriterProfile(v)
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

  // Track scroll position for "scroll to bottom" button
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-scroll when new content arrives (unless user scrolled up)
  useEffect(() => {
    if (!showScrollButton) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingText, showScrollButton])

  const { apiKey, model, baseUrl, provider } = useAISettings()

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
    if (!apiKey) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '请先在设置中配置 AI API Key。' }])
      return
    }

    // Stop any existing stream
    if (streamCleanupRef.current) {
      streamCleanupRef.current()
      streamCleanupRef.current = null
    }

    // Build user message based on mode
    let userMessage: string
    if (mode === 'review' || mode === 'summarize') {
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
      } catch { /* ignore */ }
    }

    // Build persona prefix if enabled
    let personaPrefix = ''
    if (writerProfile?.enabled) {
      personaPrefix = buildPersonaPrompt(writerProfile) + '\n\n---\n\n'
    }

    const systemMessage = (contextPrefix || personaPrefix)
      ? `你是一位专业的网文写作助手，擅长中文文学创作。你的回答应该简洁、实用、有创意。\n\n${personaPrefix}${contextPrefix}`
      : '你是一位专业的网文写作助手，擅长中文文学创作。你的回答应该简洁、实用、有创意。'

    // Extract recent content for AI continuation context
    let recentContent = ''
    if (mode === 'continue' && chapterId) {
      try {
        const ch = await window.api.chapter.get(chapterId)
        if (ch?.content) {
          const div = document.createElement('div')
          div.innerHTML = ch.content
          const plainText = div.textContent || ''
          recentContent = plainText.length > 500
            ? '...' + plainText.slice(-500)
            : plainText
        }
      } catch { /* ignore */ }
    }

    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setInput('')
    setStreamingText('')
    setLoading(true)
    setErrorMessage(null)

    // Set up stream listeners
    let fullText = ''
    const cleanup = window.api.ai.onStreamChunk((text: string) => {
      fullText += text
      setStreamingText(fullText)
    })
    window.api.ai.onStreamDone(() => {
      cleanup()
      streamCleanupRef.current = null
      setLoading(false)
      setStreamingText('')
      const finalMessages = [...newMessages, { role: 'assistant', content: fullText }]
      setMessages(finalMessages)
      saveCurrentSession(finalMessages, sessionId)
    })
    window.api.ai.onStreamError((error: string) => {
      cleanup()
      streamCleanupRef.current = null
      setLoading(false)
      setStreamingText('')
      setErrorMessage(error)
    })
    streamCleanupRef.current = cleanup

    // Start streaming request
    window.api.ai.sendMessageStream({
      messages: [
        { role: 'system', content: systemMessage },
        ...newMessages,
      ],
      apiKey, model, baseUrl, provider,
      styleSkillId: styleSkillId ?? undefined,
      recentContent,
    })
  }

  const toggleContext = async () => {
    const next = !injectContext
    setInjectContext(next)
    await window.api.setting.set('ai_inject_context', next)
  }

  const handleInputChange = (value: string) => {
    setInput(value)
    if (value === '/') {
      setShowSlashMenu(true)
    } else if (value.startsWith('/') && !value.includes(' ')) {
      setShowSlashMenu(true)
    } else {
      setShowSlashMenu(false)
    }
  }

  const handleSlashSelect = (commandId: string) => {
    const modeMap: Record<string, AIMode> = {
      continue: 'continue', polish: 'polish', expand: 'continue',
      summarize: 'summarize', review: 'review', inspire: 'inspire',
      character: 'character', outline: 'outline',
    }
    const mappedMode = modeMap[commandId] || 'continue'
    setMode(mappedMode)
    setInput('')
    setShowSlashMenu(false)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStopStream = () => {
    if (streamCleanupRef.current) {
      streamCleanupRef.current()
      streamCleanupRef.current = null
    }
    if (streamingText) {
      setMessages((prev) => [...prev, { role: 'assistant', content: streamingText }])
      saveCurrentSession(
        [...messages, { role: 'user', content: '' }, { role: 'assistant', content: streamingText }],
        sessionId
      )
    }
    setStreamingText('')
    setLoading(false)
  }

  const handleRetry = () => {
    setErrorMessage(null)
    handleSend()
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Sparkles }> = [
    { id: 'ai', label: 'AI 助手', icon: Sparkles },
    { id: 'notes', label: '笔记', icon: NotepadText },
    { id: 'outline', label: '大纲', icon: GitBranch },
    { id: 'style', label: '风格', icon: Palette },
  ]

  return (
    <aside className="w-96 border-l border-border bg-card flex flex-col h-full animate-slide-in-right">
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

          {/* Persona toggle */}
          <div className="px-3 py-1.5 border-b border-border flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={writerProfile?.enabled || false}
                onChange={async () => {
                  const updated = { ...writerProfile, enabled: !writerProfile?.enabled }
                  setWriterProfile(updated)
                  await window.api.setting.set('writer_profile', updated)
                }}
                className="accent-primary w-3 h-3"
              />
              启用写作人设
            </label>
            <button
              onClick={() => setShowWriterProfile(true)}
              className="text-[10px] text-primary hover:underline"
            >
              {writerProfile?.styleTags?.length > 0 ? '编辑' : '去设置'}
            </button>
            {writerProfile?.enabled && writerProfile?.styleTags?.length > 0 && (
              <span className="text-[10px] text-primary/60 truncate max-w-[120px]">
                {writerProfile.styleTags.map((t: string) => {
                  const opt = (['简洁','细腻','幽默','热血','诗意','写实','暗黑','温馨','悬疑','战斗','言情','哲理'] as const)
                  const keys = ['concise','detailed','humorous','passionate','poetic','realistic','dark','warm','suspense','action','romance','philosophical']
                  return opt[keys.indexOf(t)] || ''
                }).filter(Boolean).join('·')}
              </span>
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
            {messages.length === 0 && !streamingText && (
              <div className="text-center text-sm text-muted-foreground mt-8">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary/40" />
                <p>选择模式并发送消息</p>
                <p className="text-xs mt-1">AI 可以帮你续写、润色、审稿、生成摘要等</p>
                <p className="text-xs text-muted-foreground/60 mt-2">输入 <kbd className="px-1 py-0.5 bg-accent rounded text-[10px]">/</kbd> 快速切换模式</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn(
                'text-sm rounded-lg p-2.5 max-w-full',
                msg.role === 'user' ? 'bg-primary/10 ml-4' : 'bg-accent mr-2'
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && msg.content && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => onInsert(msg.content)}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Copy className="w-3 h-3" /> 插入编辑器
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content)
                        setCopiedIndex(i)
                        setTimeout(() => setCopiedIndex(null), 2000)
                      }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copiedIndex === i ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      {copiedIndex === i ? '已复制' : '复制'}
                    </button>
                    {mode === 'summarize' && (
                      <button
                        onClick={() => saveNotes(msg.content)}
                        className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
                      >
                        <NotepadText className="w-3 h-3" /> 保存到笔记
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {streamingText && (
              <div className="text-sm rounded-lg p-2.5 bg-accent mr-2">
                <p className="whitespace-pre-wrap">
                  {streamingText}
                  <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
                </p>
              </div>
            )}
            {loading && !streamingText && (
              <div className="p-3 rounded-lg bg-accent mr-2">
                <div className="shimmer h-3 w-3/4 rounded mb-2" />
                <div className="shimmer h-3 w-1/2 rounded mb-2" />
                <div className="shimmer h-3 w-2/3 rounded" />
              </div>
            )}
            {errorMessage && (
              <div className="text-sm rounded-lg p-2.5 bg-destructive/10 mr-2">
                <p className="text-destructive text-xs">AI 请求失败：{errorMessage}</p>
                <button
                  onClick={handleRetry}
                  className="mt-1.5 text-xs text-primary hover:underline"
                >
                  重试
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />

            {/* Scroll to bottom button */}
            {showScrollButton && (
              <div className="sticky bottom-0 flex justify-center">
                <button
                  onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs shadow-lg hover:opacity-90"
                >
                  <ArrowDown className="w-3 h-3 inline mr-1" />
                  回到底部
                </button>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="relative">
              {showSlashMenu && (
                <SlashCommandMenu
                  open={showSlashMenu}
                  onSelect={handleSlashSelect}
                  onClose={() => setShowSlashMenu(false)}
                  inputValue={input}
                />
              )}
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={
                    mode === 'review' ? '点击发送即开始审稿（自动读取全文）...' :
                    mode === 'summarize' ? '点击发送即生成摘要（自动读取全文）...' :
                    '/ 快速切换模式，Enter 发送...'
                  }
                  rows={2}
                  className="flex-1 text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary resize-none"
                  disabled={loading && !streamingText}
                />
                {loading ? (
                  <button
                    onClick={handleStopStream}
                    className="p-2 rounded bg-destructive text-destructive-foreground hover:opacity-90"
                    title="停止生成"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    className="p-2 rounded bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 ml-1">
                Enter 发送 · Shift+Enter 换行 · / 切换模式
              </p>
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

      {/* Writer Profile Panel */}
      {showWriterProfile && (
        <div className="absolute inset-0 z-20 bg-card">
          <WriterProfile
            onClose={() => {
              setShowWriterProfile(false)
              window.api.setting.get('writer_profile').then((v) => {
                if (v) setWriterProfile(v)
              })
            }}
          />
        </div>
      )}
    </aside>
  )
}
