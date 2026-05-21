import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, Square, Clock } from 'lucide-react'

interface Props {
  initialChars: number
  onClose: () => void
  onComplete: (sessionWords: number) => void
}

const DURATIONS = [25, 45, 60]

export function PomodoroTimer({ initialChars, onClose, onComplete }: Props) {
  const [duration, setDuration] = useState(25)
  const [remaining, setRemaining] = useState(25 * 60)
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    window.api.setting.get('pomodoro_duration').then((v) => {
      if (v) {
        const d = v as number
        setDuration(d)
        setRemaining(d * 60)
      }
    })
  }, [])

  const tick = useCallback(() => {
    setRemaining((prev) => {
      if (prev <= 1) {
        clearInterval(intervalRef.current)
        setStatus('idle')
        return 0
      }
      return prev - 1
    })
  }, [])

  useEffect(() => {
    if (status === 'running') {
      intervalRef.current = setInterval(tick, 1000)
      return () => clearInterval(intervalRef.current)
    }
  }, [status, tick])

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const handleDuration = async (d: number) => {
    if (status === 'running') return
    setDuration(d)
    setRemaining(d * 60)
    await window.api.setting.set('pomodoro_duration', d)
  }

  const handleStop = () => {
    const sessionWords = 0
    onComplete(sessionWords)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[320px] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">写作番茄钟</span>
          </div>

          {/* Duration presets */}
          <div className="flex gap-2 justify-center mb-4">
            {DURATIONS.map((d) => (
              <button key={d}
                onClick={() => handleDuration(d)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  duration === d && status !== 'running'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-accent'
                } ${status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {d} min
              </button>
            ))}
          </div>

          {/* Countdown */}
          <div className="text-6xl font-mono font-bold mb-6 tabular-nums text-primary">
            {fmt(remaining)}
          </div>

          {/* Controls */}
          <div className="flex gap-3 justify-center">
            {status === 'idle' ? (
              <button onClick={() => setStatus('running')}
                className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:opacity-90 transition-opacity">
                <Play className="w-4 h-4" /> 开始
              </button>
            ) : (
              <>
                <button onClick={() => setStatus(status === 'running' ? 'paused' : 'running')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors ${status === 'paused' ? 'bg-accent' : ''}`}>
                  {status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {status === 'running' ? '暂停' : '继续'}
                </button>
                <button onClick={handleStop}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors">
                  <Square className="w-4 h-4" /> 结束
                </button>
              </>
            )}
          </div>

          {status === 'idle' && remaining === 0 && (
            <div className="mt-4 p-2 bg-green-500/10 rounded text-sm text-green-600">
              完成! 本次写作已完成
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
