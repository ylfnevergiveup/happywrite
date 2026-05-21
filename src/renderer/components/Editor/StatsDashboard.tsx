import { useState, useEffect } from 'react'
import { TrendingUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  novelId: number
  onClose: () => void
}

export function StatsDashboard({ novelId, onClose }: Props) {
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
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
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
