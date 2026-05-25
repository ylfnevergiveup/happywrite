import { useState, useEffect } from 'react'
import { BarChart, ArrowLeft, Loader2 } from 'lucide-react'
import { analyzeRhythm, getChapterStatus, STATUS_LABELS, type ChapterRhythmData } from '@/utils/rhythmAnalyzer'

interface Props {
  novelId: number
  onSelectChapter: (chapterId: number) => void
  onClose: () => void
}

export function ChapterRhythm({ novelId, onSelectChapter, onClose }: Props) {
  const [data, setData] = useState<ChapterRhythmData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const chapters = await window.api.chapter.listByNovel(novelId)
        const results: ChapterRhythmData[] = []

        for (const ch of chapters) {
          // Need full content — fetch each chapter
          const full = await window.api.chapter.get(ch.id)
          if (full?.content) {
            const rhythm = analyzeRhythm(full.content)
            results.push({
              chapterId: full.id,
              chapterTitle: full.title,
              wordCount: full.word_count,
              dialogue: rhythm.dialogue,
              action: rhythm.action,
              description: rhythm.description,
              status: getChapterStatus(rhythm.dialogue, rhythm.action, rhythm.description),
            })
          }
        }
        setData(results)
      } finally {
        setLoading(false)
      }
    })()
  }, [novelId])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-3">
        <button onClick={onClose} className="p-1 rounded hover:bg-accent">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <BarChart className="w-4 h-4 text-primary" />
          章节节奏仪表盘
        </h2>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-500" /> 对话
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-400" /> 动作
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-gray-300 dark:bg-gray-600" /> 描写
            </span>
          </div>

          {/* Chapter bars */}
          <div className="space-y-3">
            {data.map((ch) => (
              <div key={ch.chapterId}>
                <div
                  onClick={() => onSelectChapter(ch.chapterId)}
                  className="flex items-center gap-2 mb-0.5 cursor-pointer hover:text-primary transition-colors group"
                >
                  <span className="text-xs w-12 text-right text-muted-foreground shrink-0">
                    Ch{ch.chapterId}
                  </span>
                  <span className="text-xs truncate group-hover:underline">
                    {ch.chapterTitle}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {STATUS_LABELS[ch.status].icon} {STATUS_LABELS[ch.status].label}
                  </span>
                </div>

                {/* Stacked bar */}
                <div className="flex items-center gap-2">
                  <div className="w-12 shrink-0" />
                  <div className="flex-1 h-5 rounded overflow-hidden flex bg-gray-100 dark:bg-gray-800">
                    {ch.dialogue > 0 && (
                      <div
                        className="bg-blue-500 h-full transition-all"
                        style={{ width: `${ch.dialogue}%` }}
                        title={`对话 ${ch.dialogue}%`}
                      />
                    )}
                    {ch.action > 0 && (
                      <div
                        className="bg-red-400 h-full transition-all"
                        style={{ width: `${ch.action}%` }}
                        title={`动作 ${ch.action}%`}
                      />
                    )}
                    {ch.description > 0 && (
                      <div
                        className="bg-gray-300 dark:bg-gray-600 h-full transition-all"
                        style={{ width: `${ch.description}%` }}
                        title={`描写 ${ch.description}%`}
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground w-14 text-right shrink-0">
                    {ch.wordCount}字
                  </span>
                </div>

                {/* Percentage labels */}
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-12 shrink-0" />
                  <div className="flex-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>对话 {ch.dialogue}%</span>
                    <span>动作 {ch.action}%</span>
                    <span>描写 {ch.description}%</span>
                  </div>
                  <div className="w-14 shrink-0" />
                </div>
              </div>
            ))}
          </div>

          {data.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-accent text-xs text-muted-foreground">
              <p className="font-medium mb-1">节奏建议：</p>
              {data.filter((c) => c.status === 'slow').length > 0 && (
                <p>🐌 {data.filter((c) => c.status === 'slow').length} 章描写偏多，可考虑增加对话或动作场景</p>
              )}
              {data.filter((c) => c.status === 'fast').length > 0 && (
                <p>⚡ {data.filter((c) => c.status === 'fast').length} 章对话密集，可适当增加描写铺垫</p>
              )}
              {data.filter((c) => c.status === 'balanced').length === data.length && (
                <p>✅ 所有章节节奏均衡</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
