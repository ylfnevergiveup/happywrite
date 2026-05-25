import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Square, Copy, Check, ChevronDown } from 'lucide-react'
import { useAISettings } from '@/hooks/useAISettings'

interface Props {
  selectedText: string
  position: { top: number; left: number }
  onClose: () => void
  onReplace: (html: string) => void
  onInsertAfter: (html: string) => void
}

const QUICK_ACTIONS = [
  { id: 'polish', label: '改写', prompt: '请改写以下文本，保持原意不变，使语言更加优美流畅。只返回改写后的文本，不要加任何解释：' },
  { id: 'expand', label: '扩写', prompt: '请扩写以下文本，增加细节描写、心理活动或环境渲染，使内容更加充实。保持风格一致，只返回扩写后的文本，不要加任何解释：' },
  { id: 'shorten', label: '缩写', prompt: '请缩写以下文本，提取核心要点，精炼表达。只返回缩写后的文本，不要加任何解释：' },
  { id: 'rephrase', label: '换个说法', prompt: '请用不同的表达方式重写以下文本，意思不变，但换一种表述。只返回重写后的文本，不要加任何解释：' },
]

function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function AIFloatPanel({ selectedText, position, onClose, onReplace, onInsertAfter }: Props) {
  const { apiKey, model, baseUrl, provider } = useAISettings()
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [copied, setCopied] = useState(false)
  const streamCleanupRef = useRef<(() => void) | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleAction = useCallback(async (actionPrompt: string) => {
    if (!apiKey) {
      setErrorMessage('请先在设置中配置 AI API Key')
      return
    }

    if (streamCleanupRef.current) {
      streamCleanupRef.current()
      streamCleanupRef.current = null
    }

    setLoading(true)
    setStreamingText('')
    setResult(null)
    setErrorMessage(null)

    const userMessage = `${actionPrompt}\n\n${selectedText}`

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
      setResult(fullText)
    })
    window.api.ai.onStreamError((error: string) => {
      cleanup()
      streamCleanupRef.current = null
      setLoading(false)
      setStreamingText('')
      setErrorMessage(error)
    })
    streamCleanupRef.current = cleanup

    window.api.ai.sendMessageStream({
      messages: [
        { role: 'user', content: userMessage },
      ],
      apiKey, model, baseUrl, provider,
    })
  }, [apiKey, model, baseUrl, provider, selectedText])

  const handleCustomSend = () => {
    if (!customInput.trim()) return
    handleAction(customInput.trim())
    setCustomInput('')
  }

  const handleStopStream = () => {
    if (streamCleanupRef.current) {
      streamCleanupRef.current()
      streamCleanupRef.current = null
    }
    if (streamingText) {
      setResult(streamingText)
    }
    setStreamingText('')
    setLoading(false)
  }

  const handleReplace = () => {
    if (result) {
      onReplace(textToHtml(result))
      onClose()
    }
  }

  const handleInsertAfter = () => {
    if (result) {
      onInsertAfter(textToHtml(result))
      onClose()
    }
  }

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const adjustedTop = position.top - 250 < 0 ? position.top + 30 : position.top - 8
  const adjustedLeft = Math.max(16, Math.min(position.left - 180, window.innerWidth - 392))

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-[360px] bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
      style={{ top: adjustedTop, left: adjustedLeft }}
    >
      {/* Header: selected text preview */}
      <div className="px-3 py-2 border-b border-border bg-accent/30">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">选中文字</span>
          <button onClick={onClose} className="p-0.5 rounded hover:bg-accent">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-foreground mt-0.5 line-clamp-2">
          {selectedText.slice(0, 60)}
          {selectedText.length > 60 ? '...' : ''}
        </p>
      </div>

      {/* Quick action buttons */}
      <div className="px-3 py-2 flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.prompt)}
            disabled={loading}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-accent/50 hover:bg-accent text-foreground transition-colors disabled:opacity-40"
          >
            {action.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustomInput(!showCustomInput)}
          className="px-2.5 py-1.5 text-xs rounded-lg bg-accent/30 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className="w-3 h-3 inline mr-1" />
          自定义
        </button>
      </div>

      {/* Custom input */}
      {showCustomInput && (
        <div className="px-3 pb-2 flex gap-1.5">
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSend() }}
            placeholder="自定义指令，如：用更口语化的方式改写..."
            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <button
            onClick={handleCustomSend}
            disabled={loading || !customInput.trim()}
            className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Result area */}
      {(loading || streamingText || result || errorMessage) && (
        <div className="border-t border-border px-3 py-2">
          {errorMessage && (
            <div className="text-xs text-destructive">
              {errorMessage}
              <button onClick={() => handleAction(QUICK_ACTIONS[0].prompt)} className="ml-2 text-primary hover:underline">重试</button>
            </div>
          )}

          {streamingText && (
            <div>
              <p className="text-xs whitespace-pre-wrap text-foreground leading-relaxed max-h-48 overflow-y-auto">
                {streamingText}
                <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />
              </p>
              <button
                onClick={handleStopStream}
                className="mt-2 px-2 py-1 text-xs rounded bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                <Square className="w-3 h-3 inline mr-1" />停止生成
              </button>
            </div>
          )}

          {loading && !streamingText && (
            <div className="space-y-1.5">
              <div className="shimmer h-2.5 w-full rounded" />
              <div className="shimmer h-2.5 w-3/4 rounded" />
            </div>
          )}

          {result && (
            <div>
              <p className="text-xs whitespace-pre-wrap text-foreground leading-relaxed max-h-48 overflow-y-auto">
                {result}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={handleReplace} className="px-2.5 py-1 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90">
                  替换原文
                </button>
                <button onClick={handleInsertAfter} className="px-2.5 py-1 text-xs rounded-lg bg-accent hover:bg-accent/80 text-foreground">
                  插入后面
                </button>
                <button onClick={handleCopy} className="px-2.5 py-1 text-xs rounded-lg bg-accent hover:bg-accent/80 text-muted-foreground">
                  {copied ? <Check className="w-3 h-3 inline mr-1 text-green-500" /> : <Copy className="w-3 h-3 inline mr-1" />}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
