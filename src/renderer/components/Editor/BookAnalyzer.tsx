import { useState, useRef } from 'react'
import { Sparkles, Loader2, XCircle, BookOpen, ChevronDown, ChevronRight, FileText, Target, GitBranch, Download, X, Upload, FileUp, AlertCircle } from 'lucide-react'
import type { OutlineNode } from '@/types'

interface Props {
  novelId: number
  onClose: () => void
}

interface ChapterAnalysis {
  chapterId: number
  chapterTitle: string
  summary: string
  keyEvents: string[]
  characters: string[]
  mood: string
  wordCount: number
}

interface GlobalAnalysis {
  structure: string
  characterArcs: string
  rhythm: string
  themes: string
  suggestions: string
}

const CHAPTER_ANALYSIS_PROMPT = `请分析以下小说章节，提取关键信息。严格按照JSON格式返回，不要加任何解释：

{
  "summary": "章节摘要（50字以内）",
  "keyEvents": ["关键事件1", "关键事件2"],
  "characters": ["角色名: 状态变化或重要行动"],
  "mood": "情绪基调（1-3个词，如：紧张、温馨、悲伤）"
}

章节标题：{title}
章节字数：{words}

章节内容：
{content}`

const GLOBAL_ANALYSIS_PROMPT = `你是一位资深小说编辑。以下是小说所有章节的分析摘要。请完成深度拆书分析。

## 各章节分析
{chapters}

请按以下结构输出分析报告（用Markdown格式）：

### 一、故事结构
- 识别整体结构类型（三幕/五幕/章回体等）
- 标注结构转折点及各幕分布
- 评价结构完整性和节奏

### 二、人物弧光
- 每个角色的成长轨迹
- 人物关系变化
- 人物塑造的亮点与不足

### 三、节奏分析
- 各章节的情绪/张弛节奏
- 高潮点的设置是否合理
- 是否有拖沓或过快的问题

### 四、主题分析
- 核心主题及体现方式
- 象征和隐喻的使用
- 主题深度的评价

### 五、改进建议
- 结构层面的优化建议
- 人物层面的深化建议
- 节奏和篇幅的调整建议`

export function BookAnalyzer({ novelId, onClose }: Props) {
  const [phase, setPhase] = useState<'idle' | 'analyzing_chapters' | 'global_analysis' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0, title: '' })
  const [chapterAnalyses, setChapterAnalyses] = useState<ChapterAnalysis[]>([])
  const [globalAnalysis, setGlobalAnalysis] = useState<GlobalAnalysis | null>(null)
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const abortRef = useRef(false)

  // File import mode
  const [mode, setMode] = useState<'chapters' | 'file'>('chapters')
  const [importedFile, setImportedFile] = useState<{
    fileName: string; fileType: string; fileSize: number; charCount: number; content: string
  } | null>(null)

  const handleImportFile = async () => {
    const result = await window.api.importFile.openFile()
    if (!result.success) {
      if (result.error !== '用户取消') {
        setError(result.error || '导入失败')
        setPhase('error')
      }
      return
    }
    setImportedFile({
      fileName: result.fileName!,
      fileType: result.fileType!,
      fileSize: result.fileSize!,
      charCount: result.charCount!,
      content: result.content!,
    })
    setError('')
  }

  const getAISettings = async () => {
    const [apiKey, model, provider, baseUrl] = await Promise.all([
      window.api.setting.get('ai_api_key'),
      window.api.setting.get('ai_model'),
      window.api.setting.get('ai_provider'),
      window.api.setting.get('ai_base_url'),
    ])
    return {
      apiKey: (apiKey as string) || '',
      model: (model as string) || 'claude-sonnet-4-6',
      provider: (provider as string) || 'anthropic',
      baseUrl: (baseUrl as string) || '',
    }
  }

  const callAI = async (userMessage: string): Promise<string> => {
    const settings = await getAISettings()
    if (!settings.apiKey) throw new Error('请先在设置中配置AI API密钥')

    const response = await window.api.ai.sendMessage({
      messages: [
        { role: 'system', content: '你是一位专业的小说分析助手，擅长文学分析和内容拆解。请严格按照要求的格式返回结果。' },
        { role: 'user', content: userMessage },
      ],
      apiKey: settings.apiKey,
      model: settings.model,
      provider: settings.provider as any,
      baseUrl: settings.baseUrl,
    })

    return typeof response === 'string' ? response : (response as any)?.content || ''
  }

  const parseChapterJSON = (text: string): ChapterAnalysis | null => {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      return JSON.parse(jsonMatch[0])
    } catch {
      return null
    }
  }

  const startAnalysis = async () => {
    abortRef.current = false
    setPhase('analyzing_chapters')
    setError('')

    try {
      let items: Array<{ id: number; title: string; content: string; words: number }> = []

      if (mode === 'chapters') {
        const chapters = await window.api.chapter.listByNovel(novelId)
        if (chapters.length === 0) {
          setError('当前没有章节可供分析')
          setPhase('error')
          return
        }
        // Load full content for each chapter
        for (const ch of chapters) {
          const full = await window.api.chapter.get(ch.id)
          items.push({
            id: ch.id,
            title: ch.title,
            content: (full?.content || '').slice(0, 8000),
            words: full?.word_count || 0,
          })
        }
      } else {
        // File import mode: split content by natural breaks
        if (!importedFile) {
          setError('请先导入文件')
          setPhase('error')
          return
        }
        const content = importedFile.content
        // Split by --- separators or chapter markers
        const parts = content.split(/\n\n---\n\n/)
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i].trim()
          if (part.length < 50) continue
          // Try to extract title from first line or heading
          const lines = part.split('\n')
          const firstLine = lines[0].replace(/^#+\s*/, '').trim()
          const title = firstLine.length < 60 ? firstLine : `第${i + 1}部分`
          items.push({
            id: i,
            title,
            content: part.slice(0, 8000),
            words: part.length,
          })
        }
      }

      if (items.length === 0) {
        setError('没有可供分析的内容')
        setPhase('error')
        return
      }

      setProgress({ current: 0, total: items.length, title: '' })

      const analyses: ChapterAnalysis[] = []
      const BATCH_SIZE = 3

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        if (abortRef.current) return

        const batch = items.slice(i, i + BATCH_SIZE)
        const batchPromises = batch.map(async (item) => {
          if (abortRef.current) return null
          setProgress((p) => ({ ...p, title: item.title }))

          const prompt = CHAPTER_ANALYSIS_PROMPT
            .replace('{title}', item.title)
            .replace('{words}', String(item.words))
            .replace('{content}', item.content)

          try {
            const result = await callAI(prompt)
            const parsed = parseChapterJSON(result)
            return {
              chapterId: item.id,
              chapterTitle: item.title,
              summary: parsed?.summary || result.slice(0, 100),
              keyEvents: parsed?.keyEvents || [],
              characters: parsed?.characters || [],
              mood: parsed?.mood || '',
              wordCount: item.words,
            } as ChapterAnalysis
          } catch {
            return null
          }
        })

        const batchResults = await Promise.all(batchPromises)
        for (const r of batchResults) {
          if (r) analyses.push(r)
        }
        setProgress({ current: Math.min(i + BATCH_SIZE, items.length), total: items.length, title: '' })
      }

      if (abortRef.current) return

      setChapterAnalyses(analyses)
      setPhase('global_analysis')
      setProgress({ current: 0, total: 1, title: '汇总分析中...' })

      const chaptersText = analyses.map((a, i) =>
        `### 第${i + 1}部分: ${a.chapterTitle}
**摘要**: ${a.summary}
**关键事件**: ${a.keyEvents.join(', ') || '无'}
**出场人物**: ${a.characters.join(', ') || '无'}
**情绪基调**: ${a.mood || '未标注'}
**字数**: ${a.wordCount}`
      ).join('\n\n')

      const globalPrompt = GLOBAL_ANALYSIS_PROMPT.replace('{chapters}', chaptersText)

      const result = await callAI(globalPrompt)

      if (abortRef.current) return

      // Parse global analysis
      const structureMatch = result.match(/###\s*一、故事结构([\s\S]*?)(?=###\s*二|$)/)
      const characterMatch = result.match(/###\s*二、人物弧光([\s\S]*?)(?=###\s*三|$)/)
      const rhythmMatch = result.match(/###\s*三、节奏分析([\s\S]*?)(?=###\s*四|$)/)
      const themeMatch = result.match(/###\s*四、主题分析([\s\S]*?)(?=###\s*五|$)/)
      const suggestionMatch = result.match(/###\s*五、改进建议([\s\S]*?)$/)

      setGlobalAnalysis({
        structure: structureMatch?.[1]?.trim() || result,
        characterArcs: characterMatch?.[1]?.trim() || '',
        rhythm: rhythmMatch?.[1]?.trim() || '',
        themes: themeMatch?.[1]?.trim() || '',
        suggestions: suggestionMatch?.[1]?.trim() || '',
      })

      setPhase('done')
    } catch (e: any) {
      setError(e?.message || String(e))
      setPhase('error')
    }
  }

  const handleImportOutline = async () => {
    if (!globalAnalysis || !chapterAnalyses.length) return

    try {
      // Create root node for the analysis
      const bookTitle = await window.api.novel.get(novelId)
      const rootNode = await window.api.outline.create({
        novel_id: novelId,
        parent_id: null,
        title: `《${bookTitle?.title || '作品'}》拆书分析`,
        type: 'arc',
        description: 'AI自动生成的拆书分析结果',
      })

      // Create structure node
      const structureNode = await window.api.outline.create({
        novel_id: novelId,
        parent_id: rootNode.id,
        title: '故事结构',
        type: 'act',
        description: globalAnalysis.structure.slice(0, 500),
      })

      // Create character node
      if (globalAnalysis.characterArcs) {
        await window.api.outline.create({
          novel_id: novelId,
          parent_id: rootNode.id,
          title: '人物弧光',
          type: 'act',
          description: globalAnalysis.characterArcs.slice(0, 500),
        })
      }

      // Create rhythm node
      if (globalAnalysis.rhythm) {
        await window.api.outline.create({
          novel_id: novelId,
          parent_id: rootNode.id,
          title: '节奏分析',
          type: 'act',
          description: globalAnalysis.rhythm.slice(0, 500),
        })
      }

      // Create theme node
      if (globalAnalysis.themes) {
        await window.api.outline.create({
          novel_id: novelId,
          parent_id: rootNode.id,
          title: '主题分析',
          type: 'act',
          description: globalAnalysis.themes.slice(0, 500),
        })
      }

      // Create chapter nodes under structure
      for (const a of chapterAnalyses) {
        const chapterNode = await window.api.outline.create({
          novel_id: novelId,
          parent_id: structureNode.id,
          title: `第${a.chapterId}章: ${a.chapterTitle}`,
          type: 'scene',
          description: `${a.summary}\n\n情绪: ${a.mood}\n关键事件: ${a.keyEvents.join(', ')}\n出场人物: ${a.characters.join(', ')}`,
        })
        // Link to actual chapter
        await window.api.outline.linkToChapter(chapterNode.id, a.chapterId).catch(() => {})
      }

      alert('已成功导入到大纲！可在"大纲规划"中查看拆书分析结果。')
      setShowImportDialog(false)
    } catch (e: any) {
      alert('导入失败: ' + (e?.message || String(e)))
    }
  }

  const toggleChapter = (id: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExportMD = () => {
    if (!globalAnalysis) return
    const md = `# AI拆书分析报告

## 各章节摘要

${chapterAnalyses.map((a, i) => `### 第${i + 1}章: ${a.chapterTitle}
- **摘要**: ${a.summary}
- **情绪**: ${a.mood || '未标注'}
- **关键事件**: ${a.keyEvents.join(', ') || '无'}
- **出场人物**: ${a.characters.join(', ') || '无'}
- **字数**: ${a.wordCount}
`).join('\n')}

---

## 全局分析

### 故事结构
${globalAnalysis.structure}

### 人物弧光
${globalAnalysis.characterArcs}

### 节奏分析
${globalAnalysis.rhythm}

### 主题分析
${globalAnalysis.themes}

### 改进建议
${globalAnalysis.suggestions}
`

    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'book_analysis.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const SectionBlock = ({ title, content, icon: Icon }: { title: string; content: string; icon: any }) => (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-accent/30 border-b border-border flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 max-h-60 overflow-y-auto">
        {content}
      </div>
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-[560px] bg-card border-l border-border shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">AI 拆书分析</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {phase === 'idle' && (
            <div className="flex flex-col justify-center h-full text-muted-foreground gap-4 p-6">
              <div className="text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
                <p className="text-lg font-medium text-foreground mb-1">AI 智能拆书</p>
                <p className="text-sm">逐章分析情节、人物、情绪节奏</p>
                <p className="text-sm mb-4">聚合生成全本结构报告 + 改进建议</p>
              </div>

              {/* Mode selector */}
              <div className="flex gap-2 bg-muted rounded-lg p-1">
                <button
                  onClick={() => { setMode('chapters'); setImportedFile(null) }}
                  className={`flex-1 py-2 text-xs rounded-md transition-colors ${
                    mode === 'chapters'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                  分析现有章节
                </button>
                <button
                  onClick={() => setMode('file')}
                  className={`flex-1 py-2 text-xs rounded-md transition-colors ${
                    mode === 'file'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 inline mr-1" />
                  导入外部文件
                </button>
              </div>

              {/* File import mode */}
              {mode === 'file' && (
                <div className="space-y-3">
                  {/* File picker */}
                  <button
                    onClick={handleImportFile}
                    className="w-full py-8 border-2 border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-accent/30 transition-all flex flex-col items-center gap-2"
                  >
                    <FileUp className="w-10 h-10 text-muted-foreground/40" />
                    <span className="text-sm text-muted-foreground">点击选择文件</span>
                  </button>

                  {/* Imported file info */}
                  {importedFile && (
                    <div className="bg-accent/30 border border-border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{importedFile.fileName}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <span>类型: {importedFile.fileType}</span>
                        <span>大小: {(importedFile.fileSize / 1024).toFixed(1)} KB</span>
                        <span>字符: {importedFile.charCount.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Supported formats info */}
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs">
                    <div className="flex items-center gap-1.5 mb-2 text-blue-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span className="font-medium">支持的文件格式</span>
                    </div>
                    <div className="space-y-1.5 text-muted-foreground">
                      <div className="flex justify-between">
                        <span><code className="text-xs bg-muted px-1 rounded">.txt</code> 纯文本</span>
                        <span>限 10MB，约 50 万字</span>
                      </div>
                      <div className="flex justify-between">
                        <span><code className="text-xs bg-muted px-1 rounded">.md</code> Markdown</span>
                        <span>限 10MB，约 50 万字</span>
                      </div>
                      <div className="flex justify-between">
                        <span><code className="text-xs bg-muted px-1 rounded">.epub</code> EPUB 电子书</span>
                        <span>限 10MB，自动提取正文</span>
                      </div>
                    </div>
                    <p className="mt-2 text-muted-foreground/70">
                      提示：EPUB 文件会自动提取各章节正文并合并，不支持 PDF 格式（建议转换为 TXT 后导入）
                    </p>
                  </div>
                </div>
              )}

              {/* Chapters mode info */}
              {mode === 'chapters' && (
                <div className="text-xs text-muted-foreground space-y-1 bg-accent/20 rounded-lg p-3">
                  <p>• 分析当前作品的所有章节内容</p>
                  <p>• 每章独立分析，汇总生成全局报告</p>
                  <p>• 结果可一键导入大纲或导出 Markdown</p>
                  <p className="text-orange-500">• 章节较多时（10+章）耗时可能较长</p>
                </div>
              )}

              <button
                onClick={startAnalysis}
                disabled={mode === 'file' && !importedFile}
                className="w-full px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {mode === 'file' && !importedFile ? '请先导入文件' : '开始拆书'}
              </button>
            </div>
          )}

          {(phase === 'analyzing_chapters' || phase === 'global_analysis') && (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {phase === 'analyzing_chapters' ? '正在逐章分析...' : '正在汇总分析...'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {phase === 'analyzing_chapters' && progress.total > 0
                    ? `${progress.current}/${progress.total} 章`
                    : ''}
                </p>
                {progress.title && (
                  <p className="text-xs text-primary mt-1 animate-pulse">{progress.title}</p>
                )}
              </div>
              {progress.total > 0 && (
                <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{
                      width: `${phase === 'global_analysis' ? 100 : (progress.current / progress.total) * 100}%`
                    }}
                  />
                </div>
              )}
              <button
                onClick={() => { abortRef.current = true; setPhase('idle') }}
                className="text-xs text-muted-foreground hover:text-foreground underline mt-2"
              >
                取消
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <XCircle className="w-12 h-12 text-red-500" />
              <p className="text-sm text-red-500">{error}</p>
              <button
                onClick={() => setPhase('idle')}
                className="px-4 py-2 border border-border rounded-md text-sm hover:bg-accent"
              >
                返回重试
              </button>
            </div>
          )}

          {phase === 'done' && globalAnalysis && (
            <div className="p-5 space-y-4">
              {/* Chapter summaries */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  各章摘要 ({chapterAnalyses.length} 章)
                </h4>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {chapterAnalyses.map((a, i) => (
                    <div key={a.chapterId} className="border border-border rounded-lg">
                      <button
                        onClick={() => toggleChapter(a.chapterId)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent/50 rounded-lg text-left"
                      >
                        <span className="text-xs font-medium">
                          第{i + 1}章: {a.chapterTitle}
                          <span className="ml-2 text-muted-foreground">{a.mood && `· ${a.mood}`}</span>
                        </span>
                        {expandedChapters.has(a.chapterId) ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                      {expandedChapters.has(a.chapterId) && (
                        <div className="px-3 pb-3 text-xs text-muted-foreground space-y-1">
                          <p>{a.summary}</p>
                          {a.keyEvents.length > 0 && <p>🎯 {a.keyEvents.join(' → ')}</p>}
                          {a.characters.length > 0 && <p>👤 {a.characters.join(', ')}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Global analysis */}
              <div className="space-y-3">
                <SectionBlock title="故事结构" content={globalAnalysis.structure} icon={GitBranch} />
                {globalAnalysis.characterArcs && (
                  <SectionBlock title="人物弧光" content={globalAnalysis.characterArcs} icon={Target} />
                )}
                {globalAnalysis.rhythm && (
                  <SectionBlock title="节奏分析" content={globalAnalysis.rhythm} icon={GitBranch} />
                )}
                {globalAnalysis.themes && (
                  <SectionBlock title="主题分析" content={globalAnalysis.themes} icon={BookOpen} />
                )}
                {globalAnalysis.suggestions && (
                  <SectionBlock title="改进建议" content={globalAnalysis.suggestions} icon={Sparkles} />
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  onClick={handleExportMD}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-border rounded-md text-sm hover:bg-accent"
                >
                  <Download className="w-4 h-4" /> 导出MD
                </button>
                <button
                  onClick={handleImportOutline}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90"
                >
                  <GitBranch className="w-4 h-4" /> 导入大纲
                </button>
              </div>

              <button
                onClick={startAnalysis}
                className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Sparkles className="w-3 h-3" /> 重新分析
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
