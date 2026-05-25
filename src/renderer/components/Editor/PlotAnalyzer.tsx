import { useState, useEffect } from 'react'
import { X, Sparkles, Loader2, FileText } from 'lucide-react'

interface Props {
  novelId: number
  onClose: () => void
}

export function PlotAnalyzer({ novelId, onClose }: Props) {
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chapterCount, setChapterCount] = useState(0)

  useEffect(() => {
    window.api.chapter.listByNovel(novelId).then((chs) => setChapterCount(chs.length))
  }, [novelId])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setResult(null)
    setError(null)

    try {
      const apiKey = await window.api.setting.get('ai_api_key') as string
      if (!apiKey) {
        setError('请先在设置中配置 AI API Key')
        setAnalyzing(false)
        return
      }

      const model = await window.api.setting.get('ai_model') as string || 'deepseek-chat'
      const baseUrl = await window.api.setting.get('ai_base_url') as string || ''
      const provider = await window.api.setting.get('ai_provider') as string || 'deepseek'

      // Load all chapters
      const chapters = await window.api.chapter.listByNovel(novelId)

      // Build chapter summary (title + word count + content preview)
      const chapterSummaries = await Promise.all(
        chapters.map(async (ch) => {
          const full = await window.api.chapter.get(ch.id)
          const plainText = (full?.content || '').replace(/<[^>]*>/g, '').trim()
          return `### 第${ch.id}章 ${ch.title}
字数: ${ch.word_count || 0}
内容摘要: ${plainText.slice(0, 200)}${plainText.length > 200 ? '...' : ''}`
        })
      )

      const prompt = `你是一位资深的小说编辑，请对以下小说进行情节结构分析。

全书共 ${chapters.length} 章，总字数约 ${chapters.reduce((s, c) => s + (c.word_count || 0), 0)} 字。

${chapterSummaries.join('\n\n')}

请从以下维度进行分析，用中文回答，条理清晰：

## 1. 整体结构
- 是否符合经典叙事结构（三幕/四幕/起承转合）？
- 各幕的分界点在哪里？请标注章节。

## 2. 节奏分析
- 每幕的节奏如何？是否有拖沓或仓促的部分？
- 高潮部分是否足够有力？

## 3. 冲突与张力
- 核心冲突是否清晰？冲突升级是否合理？
- 是否有冲突缺失或矛盾未充分展开的段落？

## 4. 改进建议
- 列出 3 条最优先的改进建议
- 每条建议指向具体章节

格式：使用 Markdown，分级标题，关键处用**加粗**。`

      const response = await window.api.ai.sendMessage({
        messages: [{ role: 'user', content: prompt }],
        apiKey, model, baseUrl, provider,
      })

      setResult(typeof response === 'string' ? response : (response as any)?.content || '')
    } catch (e: any) {
      setError('分析失败: ' + (e?.message ?? String(e)))
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            情节结构分析
          </h2>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {analyzing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {analyzing ? '分析中...' : '开始分析'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!result && !analyzing && !error && (
          <div className="text-center text-sm text-muted-foreground mt-8">
            <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p>AI 情节结构分析</p>
            <p className="text-xs mt-1 mb-4">
              将读取全部 {chapterCount} 章内容，从结构/节奏/冲突/建议四个维度分析
            </p>
            <p className="text-xs text-muted-foreground/60">
              ⚠ 长篇小说可能耗时较长，请耐心等待
            </p>
          </div>
        )}

        {analyzing && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">AI 正在分析全书结构...</p>
              <p className="text-xs text-muted-foreground/60 mt-1">读取 {chapterCount} 章 · 可能需要 10-30 秒</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-sm text-destructive">
            {error}
            <button onClick={handleAnalyze} className="ml-2 text-primary hover:underline text-xs">重试</button>
          </div>
        )}

        {result && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {result}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
