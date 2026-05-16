import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, X, Copy, ChevronDown, NotepadText, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OutlineTree } from '../OutlineManager/OutlineTree'

type Tab = 'ai' | 'notes' | 'outline'
type AIMode = 'continue' | 'polish' | 'inspire' | 'character' | 'outline'

const modeLabels: Record<AIMode, string> = {
  continue: '续写', polish: '润色', inspire: '灵感', character: '人物', outline: '大纲',
}

const modePrompts: Record<AIMode, string> = {
  continue: '请根据上下文自然地续写接下来的内容，保持一致的文风和节奏。',
  polish: '请润色以下文字，修正语法错误，优化表达，但保留原意和风格：',
  inspire: '基于当前故事，生成3个可能的情节发展方向，每个包含简要说明：',
  character: '为故事生成一个新的人物设定，包括姓名、性格、背景和动机：',
  outline: '基于当前章节，建议下一章节的大纲，包括主要情节点：',
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
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [chapterNotes, setChapterNotes] = useState('')
  const notesTimer = useRef<ReturnType<typeof setTimeout>>()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load chapter notes when chapter changes
  useEffect(() => {
    if (chapterId) {
      window.api.chapterNote.get(chapterId).then(setChapterNotes)
    } else {
      setChapterNotes('')
    }
  }, [chapterId])

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
    return { apiKey, model: model || 'deepseek-chat', baseUrl, provider: (provider || 'deepseek') as 'claude' | 'deepseek' | 'openai' }
  }

  const handleSend = async () => {
    const { apiKey, model, baseUrl, provider } = await getSettings()
    if (!apiKey) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '请先在设置中配置 AI API Key。' }])
      return
    }

    const userMessage = input.trim()
      ? `${modePrompts[mode]}\n\n${selectedText ? `选中的文字：${selectedText}\n\n` : ''}${input}`
      : modePrompts[mode] + (selectedText ? `\n\n选中的文字：${selectedText}` : '\n\n请根据上下文提供建议。')

    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await window.api.ai.sendMessage({
        messages: [
          { role: 'system', content: '你是一位专业的网文写作助手，擅长中文文学创作。你的回答应该简洁、实用、有创意。' },
          ...newMessages,
        ],
        apiKey, model, baseUrl, provider,
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: response }])
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `AI 请求失败：${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Sparkles }> = [
    { id: 'ai', label: 'AI 助手', icon: Sparkles },
    { id: 'notes', label: '笔记', icon: NotepadText },
    { id: 'outline', label: '大纲', icon: GitBranch },
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
          {/* Mode selector */}
          <div className="px-3 py-2 border-b border-border relative">
            <button
              onClick={() => setShowModeMenu(!showModeMenu)}
              className="flex items-center justify-between w-full text-sm px-2 py-1 rounded border border-border hover:bg-accent"
            >
              {modeLabels[mode]}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showModeMenu && (
              <div className="absolute top-full left-3 right-3 mt-1 bg-popover border border-border rounded shadow-lg z-10">
                {(Object.entries(modeLabels) as [AIMode, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setMode(key); setShowModeMenu(false) }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors',
                      mode === key && 'text-primary'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {selectedText && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                已选中: {selectedText.slice(0, 30)}...
              </p>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground mt-8">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary/40" />
                <p>选择模式并发送消息</p>
                <p className="text-xs mt-1">AI 可以帮你续写、润色、提供灵感</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn(
                'text-sm rounded-lg p-2.5 max-w-full',
                msg.role === 'user' ? 'bg-primary/10 ml-4' : 'bg-accent mr-2'
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => onInsert(msg.content)}
                    className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Copy className="w-3 h-3" /> 插入到编辑器
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 正在生成...
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
                placeholder="输入指令或直接发送..."
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
    </aside>
  )
}
