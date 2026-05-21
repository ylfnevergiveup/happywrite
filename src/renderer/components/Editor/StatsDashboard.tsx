import { useState, useEffect } from 'react'
import { TrendingUp, Flame, Target, BookOpen, X } from 'lucide-react'

interface Props {
  novelId: number
  onClose: () => void
}

export function StatsDashboard({ novelId, onClose }: Props) {
  const [weeklyData, setWeeklyData] = useState<Array<{ date: string; words: number }>>([])
  const [todayWords, setTodayWords] = useState(0)
  const [dailyGoal, setDailyGoal] = useState(0)
  const [streak, setStreak] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  const loadData = async () => {
    const [tw, dg, st, tws, wd] = await Promise.all([
      window.api.stat.todayWords(novelId),
      window.api.stat.getDailyGoal(),
      window.api.stat.getStreak(novelId),
      window.api.novel.wordCount(novelId),
      window.api.stat.weeklyStats(novelId),
    ])
    setTodayWords(tw)
    setDailyGoal(dg)
    setStreak(st)
    setTotalWords(tws)
    setWeeklyData(wd)
  }

  useEffect(() => { loadData() }, [novelId])

  const progress = dailyGoal > 0 ? Math.min((todayWords / dailyGoal) * 100, 100) : 0
  const radius = 40; const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  const maxWords = Math.max(...weeklyData.map((d) => d.words), 1)

  const handleSetGoal = async () => {
    const g = parseInt(goalInput)
    if (g > 0) {
      await window.api.stat.setDailyGoal(g)
      setDailyGoal(g)
    }
    setEditingGoal(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-xl w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            写作统计
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Ring progress */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor"
                strokeWidth="6" className="text-muted" />
              <circle cx="50" cy="50" r={radius} fill="none"
                stroke={progress >= 100 ? '#22c55e' : 'var(--color-primary)'}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={offset}
                className="transition-all duration-500" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold">{Math.round(progress)}%</span>
              <span className="text-[10px] text-muted-foreground">达成率</span>
            </div>
          </div>
          <p className="text-sm mt-2">
            今日 <span className="font-semibold">{todayWords.toLocaleString()}</span>
            {dailyGoal > 0 ? ` / ${dailyGoal.toLocaleString()} 字` : ' 字'}
          </p>
          {!editingGoal ? (
            <button onClick={() => { setGoalInput(String(dailyGoal)); setEditingGoal(true) }}
              className="text-xs text-primary hover:underline mt-1 flex items-center gap-1">
              <Target className="w-3 h-3" />
              {dailyGoal > 0 ? '修改目标' : '设置每日目标'}
            </button>
          ) : (
            <div className="flex items-center gap-1 mt-1">
              <input value={goalInput} onChange={(e) => setGoalInput(e.target.value)}
                className="w-20 text-xs px-2 py-0.5 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                placeholder="字数" autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSetGoal(); if (e.key === 'Escape') setEditingGoal(false) }} />
              <button onClick={handleSetGoal} className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded">确定</button>
            </div>
          )}
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded bg-accent/50">
            <div className="text-lg font-bold text-orange-500 flex items-center justify-center gap-1">
              <Flame className="w-4 h-4" />{streak}
            </div>
            <div className="text-[10px] text-muted-foreground">连续天数</div>
          </div>
          <div className="text-center p-2 rounded bg-accent/50">
            <div className="text-lg font-bold">{todayWords.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">今日码字</div>
          </div>
          <div className="text-center p-2 rounded bg-accent/50">
            <div className="text-lg font-bold flex items-center justify-center gap-1">
              <BookOpen className="w-4 h-4" />{totalWords.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground">总字数</div>
          </div>
        </div>

        {/* Weekly bar chart */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">本周趋势</p>
          <div className="flex items-end gap-1 h-20">
            {weeklyData.map((d) => {
              const pct = maxWords > 0 ? (d.words / maxWords) * 100 : 0
              const isToday = d.date === new Date().toISOString().slice(0, 10)
              const dayLabel = ['一','二','三','四','五','六','日'][new Date(d.date + 'T00:00:00').getDay() === 0 ? 6 : new Date(d.date + 'T00:00:00').getDay() - 1]
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums">{d.words > 0 ? d.words : ''}</span>
                  <div
                    className={`w-full rounded-t transition-all ${isToday ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                  <span className={`text-[10px] ${isToday ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {dayLabel}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="pt-2 mt-2 border-t border-border text-sm font-medium">
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
