import { useState, useEffect, useCallback, useRef } from 'react'
import { Target, Flame, Maximize2, Minimize2, TrendingUp, Timer, Cloud, CloudOff, RefreshCw, CheckCircle, Columns2, FileText, X } from 'lucide-react'
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
  wordTarget?: number
  onUpdateWordTarget?: (target: number) => void
}

export function WordCount({ editor, manualWordCount, novelId, focusMode, onToggleFocus, typewriterMode, onToggleTypewriter, splitMode, onToggleSplitMode, syncState, lastSyncAt, onSync, wordTarget, onUpdateWordTarget }: Props) {
  const chars = editor?.storage?.characterCount?.characters?.() ?? 0
  const words = editor?.storage?.characterCount?.words?.() ?? 0
  const [todayWords, setTodayWords] = useState(0)
  const [dailyGoal, setDailyGoal] = useState(0)
  const [streak, setStreak] = useState(0)
  const [showStats, setShowStats] = useState(false)
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [showTargetInput, setShowTargetInput] = useState(false)
  const [targetInputValue, setTargetInputValue] = useState('')
  const targetInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (showTargetInput && targetInputRef.current) targetInputRef.current.focus()
  }, [showTargetInput])

  const progress = dailyGoal > 0 ? Math.min(todayWords / dailyGoal * 100, 100) : 0

  return (
    <>
      <div className={cn(
        'flex items-center gap-2 text-xs text-muted-foreground px-4 py-2 border-t border-border bg-card/30',
        focusMode && 'justify-between'
      )}>
        {!focusMode ? (
          <>
            {/* Writing targets group */}
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

            {/* Chapter word target */}
            {showTargetInput ? (
              <div className="flex items-center gap-1">
                <input
                  ref={targetInputRef}
                  value={targetInputValue}
                  onChange={(e) => setTargetInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && targetInputValue && /^\d+$/.test(targetInputValue) && parseInt(targetInputValue) >= 0) {
                      onUpdateWordTarget?.(parseInt(targetInputValue))
                      setShowTargetInput(false)
                      setTargetInputValue('')
                    }
                    if (e.key === 'Escape') {
                      setShowTargetInput(false)
                      setTargetInputValue('')
                    }
                  }}
                  placeholder="目标字数"
                  className="w-20 text-xs px-1.5 py-0.5 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => { setShowTargetInput(false); setTargetInputValue('') }}
                  className="p-0.5 rounded hover:bg-accent"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : wordTarget !== undefined && wordTarget > 0 ? (
              <>
                <button
                  onClick={() => { setShowTargetInput(true); setTargetInputValue(String(wordTarget)); setTimeout(() => targetInputRef.current?.focus(), 0) }}
                  className="flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  章节: {manualWordCount || 0}/{wordTarget}字
                </button>
                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      (manualWordCount || 0) >= wordTarget ? 'bg-green-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${Math.min(((manualWordCount || 0) / wordTarget) * 100, 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <button
                onClick={() => { setShowTargetInput(true); setTargetInputValue(''); setTimeout(() => targetInputRef.current?.focus(), 0) }}
                className="flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors text-muted-foreground"
                title="设置章节目标"
              >
                <FileText className="w-3 h-3" />
                章节目标
              </button>
            )}

            <span className="text-border opacity-30">|</span>

            {/* Tools group */}
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
              番茄
            </button>

            <span className="text-border opacity-30">|</span>

            {/* Counts */}
            <span>字符: {chars || manualWordCount || 0}</span>
            <span>单词: {words}</span>

            <div className="flex-1" />

{/* Sync disabled for beta */}
            {false && onSync && (
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
            {wordTarget !== undefined && wordTarget > 0 && (
              <span className="text-xs text-muted-foreground">
                章节: {manualWordCount || 0}/{wordTarget}字
              </span>
            )}
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
