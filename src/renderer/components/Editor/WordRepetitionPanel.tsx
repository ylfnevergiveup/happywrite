import { useState, useEffect, useMemo } from 'react'
import { BarChart3, X, Hash, Type, ArrowRight } from 'lucide-react'
import { analyzeRepetition, type AnalysisResult } from '@/utils/wordAnalysis'

interface Props {
  content: string
  onClose: () => void
}

export function WordRepetitionPanel({ content, onClose }: Props) {
  const [tab, setTab] = useState<'words' | 'bigrams' | 'starters'>('words')

  const analysis = useMemo(() => {
    if (!content) return null
    return analyzeRepetition(content)
  }, [content])

  if (!analysis) return null

  const tabData = {
    words: { title: '高频词', data: analysis.topWords, icon: Type, color: 'text-blue-500' },
    bigrams: { title: '词组/搭配', data: analysis.topBigrams, icon: Hash, color: 'text-purple-500' },
    starters: { title: '句首重复', data: analysis.topStarters, icon: ArrowRight, color: 'text-orange-500' },
  }

  const current = tabData[tab]
  const maxCount = Math.max(...current.data.map((d) => d.count), 1)

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed right-4 top-16 z-50 w-80 max-h-[70vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">重复词分析</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stats summary */}
        <div className="px-4 py-2 bg-accent/20 border-b border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>总词数: {analysis.totalWords.toLocaleString()}</span>
            <span>不重复词: {analysis.uniqueWords.toLocaleString()}</span>
            <span>重复率: {analysis.totalWords > 0 ? ((1 - analysis.uniqueWords / analysis.totalWords) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {Object.entries(tabData).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${
                tab === key ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-3 h-3" />
              {t.title}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3">
          {current.data.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">
              未检测到明显重复模式
            </p>
          ) : (
            <div className="space-y-2">
              {current.data.map((item, i) => (
                <div key={`${item.word}-${i}`} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{item.word}</span>
                    <span className={`${current.color} tabular-nums`}>
                      {item.count}次
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.count > 10 ? 'bg-red-500' :
                        item.count > 6 ? 'bg-orange-500' :
                        item.count > 3 ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${(item.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {current.data.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground shrink-0">
            {tab === 'words' && '高频词：出现 3 次以上，排除常用虚词'}
            {tab === 'bigrams' && '常见搭配：连续两字组合出现 3 次以上'}
            {tab === 'starters' && '句首重复：多次以相同词语开头的句子'}
          </div>
        )}
      </div>
    </>
  )
}
