import { useState, useEffect } from 'react'
import { Shield, ShieldAlert, ShieldCheck, X, Replace, Eye, EyeOff } from 'lucide-react'
import { checkSensitiveWords, getCategoryColor, type SensitiveMatch } from '@/utils/sensitiveWords'

interface Props {
  content: string
  onReplace: (index: number, length: number, replacement: string) => void
  onClose: () => void
}

export function SensitiveWordChecker({ content, onReplace, onClose }: Props) {
  const [matches, setMatches] = useState<SensitiveMatch[]>([])
  const [replaced, setReplaced] = useState<Set<number>>(new Set())
  const [showAll, setShowAll] = useState(true)

  useEffect(() => {
    if (content) {
      setMatches(checkSensitiveWords(content))
    }
  }, [content])

  const visibleMatches = showAll ? matches : matches.filter((m) => !replaced.has(m.index))

  const handleReplace = (match: SensitiveMatch, replacement: string) => {
    onReplace(match.index, match.length, replacement)
    setReplaced((prev) => new Set([...prev, match.index]))
  }

  const quickReplace = (match: SensitiveMatch) => {
    // Generate a suggestion replacement
    const suggestions: Record<string, string> = {
      '习近平': '陛下', '李克强': '丞相', '共产党': '朝廷',
      '做爱': '缠绵', '乳房': '心口', '自杀': '自我了断',
    }
    const replacement = suggestions[match.word] || '**'
    handleReplace(match, replacement)
  }

  // Group by category
  const grouped = new Map<string, SensitiveMatch[]>()
  for (const m of visibleMatches) {
    if (!grouped.has(m.category)) grouped.set(m.category, [])
    grouped.get(m.category)!.push(m)
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed right-4 top-16 z-50 w-80 max-h-[70vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {matches.length > 0 ? (
              <ShieldAlert className="w-4 h-4 text-red-500" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-green-500" />
            )}
            <span className="text-sm font-medium">敏感词检测</span>
            {matches.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">
                {matches.length - replaced.size}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowAll(!showAll)}
              className="p-1 rounded hover:bg-accent"
              title={showAll ? '隐藏已处理' : '显示全部'}
            >
              {showAll ? <Eye className="w-3.5 h-3.5 text-muted-foreground" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-accent">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <ShieldCheck className="w-10 h-10 text-green-500/30" />
              <p className="text-sm">未检测到敏感词</p>
              <p className="text-xs">当前章节通过基础审核检查</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                  {category} ({items.length})
                </div>
                <div className="space-y-1">
                  {items.map((match, i) => (
                    <div
                      key={`${match.index}-${i}`}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${getCategoryColor(match.category)}`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">"{match.word}"</span>
                        <span className="ml-1 text-[10px] opacity-70">
                          {match.suggestion.slice(0, 40)}...
                        </span>
                      </div>
                      <button
                        onClick={() => quickReplace(match)}
                        className="ml-2 px-2 py-0.5 rounded text-[10px] bg-background/50 hover:bg-background shrink-0 flex items-center gap-1"
                      >
                        <Replace className="w-3 h-3" /> 替换
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Add custom word section */}
          <div className="border-t border-border pt-3">
            <p className="text-[10px] text-muted-foreground mb-2">
              提示：此为内置基础词库，覆盖主流网文平台常见审核关键词。更多平台规则请参考对应内容规范。
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
