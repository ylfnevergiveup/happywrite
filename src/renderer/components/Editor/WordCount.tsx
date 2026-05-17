import { useState, useEffect, useCallback } from 'react'
import { Target, Flame, Maximize2, Minimize2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  editor: { storage?: { characterCount?: { characters?: () => number; words?: () => number } } } | null
  manualWordCount?: number
  novelId: number
  focusMode: boolean
  onToggleFocus: () => void
  typewriterMode: boolean
  onToggleTypewriter: () => void
}

export function WordCount({ editor, manualWordCount, novelId, focusMode, onToggleFocus, typewriterMode, onToggleTypewriter }: Props) {
  const chars = editor?.storage?.characterCount?.characters?.() ?? 0
  const words = editor?.storage?.characterCount?.words?.() ?? 0
  const [todayWords, setTodayWords] = useState(0)
  const [dailyGoal, setDailyGoal] = useState(0)
  const [streak, setStreak] = useState(0)
  const [showStats, setShowStats] = useState(false)

  const loadStats = useCallback(async () => {
    const [tw, dg, st] = await Promise.all([
      window.api.stat.todayWords(novelId),
      window.api.stat.getDailyGoal(),
      window.api.stat.getStreak(novelId),
    ])
    setTodayWords(tw)
    setDailyGoal(dg)
    setStreak(st)
  }, [novelId])

  useEffect(() => { loadStats() }, [loadStats])

  const progress = dailyGoal > 0 ? Math.min(todayWords / dailyGoal * 100, 100) : 0

  return (
    <>
      <div className={cn(
        'flex items-center gap-2 text-xs text-muted-foreground px-4 py-1.5 border-t border-border bg-card/30',
        focusMode && 'justify-between'
      )}>
        {!focusMode ? (
          <>
            <button
              onClick={async () => {
                const goal = prompt('设置每日码字目标:', String(dailyGoal))
                if (goal && /^\d+$/.test(goal)) {
                  await window.api.stat.setDailyGoal(parseInt(goal))
                  setDailyGoal(parseInt(goal))
                }
              }}
              className="flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors"
            >
              <Target className="w-3 h-3" />
              今日: {todayWords} 字
              {dailyGoal > 0 && ` / ${dailyGoal} 字`}
            </button>

            {dailyGoal > 0 && (
              <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', progress >= 100 ? 'bg-green-500' : 'bg-primary')}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <span className="flex items-center gap-1">
              <Flame className={cn('w-3 h-3', streak > 0 && 'text-orange-500')} />
              {streak} 天连续
            </span>

            <button
              onClick={() => setShowStats(true)}
              className="flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors"
            >
              <TrendingUp className="w-3 h-3" />
              统计
            </button>

            <span className="mx-1 text-border">|</span>

            <span>字符数: {chars || manualWordCount || 0}</span>
            <span>单词数: {words}</span>

            <div className="flex-1" />

            <button
              onClick={onToggleFocus}
              className="flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
              专注
            </button>
          </>
        ) : (
          <>
            <span>字符数: {chars || manualWordCount || 0} · 单词数: {words}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleTypewriter}
                className={cn(
                  'flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors text-xs',
                  typewriterMode && 'text-primary bg-accent'
                )}
                title="打字机模式"
              >
                打字机
              </button>
              <button
                onClick={onToggleFocus}
                className="flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors"
              >
                <Minimize2 className="w-3 h-3" />
                退出专注
              </button>
            </div>
          </>
        )}
      </div>

      {showStats && <StatsPanel novelId={novelId} onClose={() => setShowStats(false)} />}
    </>
  )
}

function StatsPanel({ novelId, onClose }: { novelId: number; onClose: () => void }) {
  const [weeklyData, setWeeklyData] = useState<Array<{ date: string; words: number }>>([])

  useEffect(() => {
    window.api.stat.weeklyStats(novelId).then(setWeeklyData)
  }, [novelId])

  const maxWords = Math.max(...weeklyData.map((d) => d.words), 1)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-xl w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            本周写作统计
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="space-y-2">
          {weeklyData.map((d) => {
            const pct = maxWords > 0 ? (d.words / maxWords) * 100 : 0
            const isToday = d.date === new Date().toISOString().slice(0, 10)
            return (
              <div key={d.date} className="flex items-center gap-2 text-sm">
                <span className="w-20 text-muted-foreground">
                  {d.date.slice(5)}{isToday ? ' (今天)' : ''}
                </span>
                <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                  <div
                    className={cn('h-full rounded bg-primary transition-all', isToday && 'ring-2 ring-primary/30')}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="w-16 text-right tabular-nums">{d.words.toLocaleString()} 字</span>
              </div>
            )
          })}
          <div className="pt-2 border-t border-border text-sm font-medium">
            本周总计: {weeklyData.reduce((s, d) => s + d.words, 0).toLocaleString()} 字
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90"
        >
          关闭
        </button>
      </div>
    </div>
  )
}
