import { useState, useEffect, useCallback } from 'react'
import { Target, Flame, Maximize2, Minimize2, TrendingUp, Timer, Cloud, CloudOff, RefreshCw, CheckCircle, Columns2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatsDashboard } from './StatsDashboard'
import { PomodoroTimer } from './PomodoroTimer'

interface Props {
  editor: { storage?: { characterCount?: { characters?: () => number; words?: () => number } } } | null
  manualWordCount?: number
  novelId: number
  focusMode: boolean
  onToggleFocus: () => void
  typewriterMode: boolean
  onToggleTypewriter: () => void
  splitMode?: boolean
  onToggleSplitMode?: () => void
  syncState?: 'idle' | 'syncing' | 'success' | 'error'
  lastSyncAt?: string | null
  onSync?: () => void
}

export function WordCount({ editor, manualWordCount, novelId, focusMode, onToggleFocus, typewriterMode, onToggleTypewriter, splitMode, onToggleSplitMode, syncState, lastSyncAt, onSync }: Props) {
  const chars = editor?.storage?.characterCount?.characters?.() ?? 0
  const words = editor?.storage?.characterCount?.words?.() ?? 0
  const [todayWords, setTodayWords] = useState(0)
  const [dailyGoal, setDailyGoal] = useState(0)
  const [streak, setStreak] = useState(0)
  const [showStats, setShowStats] = useState(false)
  const [showPomodoro, setShowPomodoro] = useState(false)

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

            <button
              onClick={() => setShowPomodoro(true)}
              className="flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors"
            >
              <Timer className="w-3 h-3" />
              番茄钟
            </button>

            <span className="mx-1 text-border">|</span>

            <span>字符数: {chars || manualWordCount || 0}</span>
            <span>单词数: {words}</span>

            <div className="flex-1" />

            {onSync && (
              <button
                onClick={onSync}
                className={cn(
                  'flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors',
                  syncState === 'error' && 'text-red-500',
                  syncState === 'syncing' && 'text-primary',
                  syncState === 'success' && 'text-green-600'
                )}
                title={lastSyncAt ? `上次同步: ${new Date(lastSyncAt).toLocaleString()}` : '点击同步'}
              >
                {syncState === 'syncing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                {syncState === 'success' && <CheckCircle className="w-3 h-3" />}
                {syncState === 'error' && <CloudOff className="w-3 h-3" />}
                {syncState === 'idle' && <Cloud className="w-3 h-3" />}
                云同步
              </button>
            )}

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
              {onToggleSplitMode && (
                <button
                  onClick={onToggleSplitMode}
                  className={cn(
                    'flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors text-xs',
                    splitMode && 'text-primary bg-accent'
                  )}
                  title="分屏模式"
                >
                  <Columns2 className="w-3 h-3" /> 分屏
                </button>
              )}
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

      {showStats && <StatsDashboard novelId={novelId} onClose={() => setShowStats(false)} />}

      {showPomodoro && (
        <PomodoroTimer
          getChars={() => editor?.storage?.characterCount?.characters?.() ?? 0}
          onClose={() => setShowPomodoro(false)}
          onComplete={(sessionWords) => {
            if (sessionWords > 0) window.api.stat.recordWords(novelId, sessionWords).catch(() => {})
            setShowPomodoro(false)
            loadStats()
          }}
        />
      )}
    </>
  )
}
