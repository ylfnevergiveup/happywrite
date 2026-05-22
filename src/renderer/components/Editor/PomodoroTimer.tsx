import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, Square, Clock, Volume2, ChevronDown } from 'lucide-react'

interface Props {
  getChars: () => number
  onClose: () => void
  onComplete: (sessionWords: number) => void
}

const PRESETS = [25, 45, 60]

const SOUNDS: Record<string, { label: string; freq: number[]; duration: number[]; type: OscillatorType }> = {
  classic:   { label: '经典滴滴', freq: [800, 600], duration: [150, 150], type: 'square' },
  chime:     { label: '风铃', freq: [523, 659, 784], duration: [200, 200, 400], type: 'sine' },
  bell:      { label: '铃声', freq: [440, 554, 660], duration: [150, 150, 300], type: 'triangle' },
  digital:   { label: '电子', freq: [1000, 1200, 1400], duration: [100, 100, 200], type: 'sawtooth' },
  soft:      { label: '柔和', freq: [400, 500], duration: [300, 500], type: 'sine' },
}

function playSound(soundKey: string) {
  try {
    const ctx = new AudioContext()
    const sound = SOUNDS[soundKey] || SOUNDS.classic
    let time = ctx.currentTime

    for (let i = 0; i < sound.freq.length; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = sound.type
      osc.frequency.setValueAtTime(sound.freq[i], time)
      gain.gain.setValueAtTime(0.3, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + sound.duration[i] / 1000)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(time)
      osc.stop(time + sound.duration[i] / 1000)
      time += sound.duration[i] / 1000 + 0.05
    }

    setTimeout(() => ctx.close(), 3000)
  } catch {
    // Audio not available
  }
}

export function PomodoroTimer({ getChars, onClose, onComplete }: Props) {
  const [duration, setDuration] = useState(25)
  const [customMin, setCustomMin] = useState('')
  const [remaining, setRemaining] = useState(25 * 60)
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle')
  const [sound, setSound] = useState('classic')
  const [showSoundMenu, setShowSoundMenu] = useState(false)
  const charsAtStart = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  // Load settings
  useEffect(() => {
    window.api.setting.get('pomodoro_duration').then((v) => {
      if (v) {
        const d = v as number
        setDuration(d)
        setRemaining(d * 60)
      }
    })
    window.api.setting.get('pomodoro_sound').then((v) => {
      if (v) setSound(v as string)
    })
  }, [])

  const finish = useCallback(() => {
    clearInterval(intervalRef.current)
    const words = getChars() - charsAtStart.current
    playSound(sound)
    onComplete(Math.max(0, words))
  }, [getChars, onComplete, sound])

  const tick = useCallback(() => {
    setRemaining((prev) => {
      if (prev <= 1) return 0
      return prev - 1
    })
  }, [])

  useEffect(() => {
    if (remaining === 0 && status === 'running') {
      setStatus('idle')
      finish()
    }
  }, [remaining, status, finish])

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
    setCustomMin('')
    await window.api.setting.set('pomodoro_duration', d)
  }

  const handleCustomTime = async () => {
    if (status === 'running') return
    const mins = parseInt(customMin)
    if (mins > 0 && mins <= 180) {
      setDuration(mins)
      setRemaining(mins * 60)
      await window.api.setting.set('pomodoro_duration', mins)
    }
  }

  const handleCustomKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCustomTime()
  }

  const handleSoundChange = async (key: string) => {
    setSound(key)
    setShowSoundMenu(false)
    await window.api.setting.set('pomodoro_sound', key)
  }

  const handlePreviewSound = (key: string) => {
    playSound(key)
  }

  const handleStart = () => {
    charsAtStart.current = getChars()
    setStatus('running')
  }

  const handleStop = () => {
    setStatus('idle')
    finish()
  }

  const progress = duration > 0 ? ((duration * 60 - remaining) / (duration * 60)) * 100 : 0

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[360px] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">写作番茄钟</span>
          </div>

          {/* Progress bar */}
          {status !== 'idle' && (
            <div className="w-full h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Time picker */}
          <div className="flex gap-2 justify-center mb-3 flex-wrap items-center">
            {PRESETS.map((d) => (
              <button key={d}
                onClick={() => handleDuration(d)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  duration === d && customMin === ''
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-accent'
                } ${status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {d} min
              </button>
            ))}
            <div className="flex items-center gap-1">
              <input
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value.replace(/\D/g, '').slice(0, 3))}
                onBlur={handleCustomTime}
                onKeyDown={handleCustomKey}
                disabled={status === 'running'}
                placeholder="自定义"
                className={`w-16 text-xs px-2 py-1 rounded-full border border-border bg-background text-center outline-none focus:ring-1 focus:ring-primary ${
                  status === 'running' ? 'opacity-50 cursor-not-allowed' : ''
                } ${customMin !== '' ? 'ring-1 ring-primary bg-accent' : ''}`}
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>

          {/* Timer display */}
          <div className="relative mb-4">
            <svg className="w-36 h-36 mx-auto -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="4"
                className="text-muted" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="4"
                className="text-primary transition-all duration-1000 ease-linear"
                strokeDasharray={`${progress * 2.76} ${276 - progress * 2.76}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-mono font-bold tabular-nums text-primary">
                {fmt(remaining)}
              </span>
            </div>
          </div>

          {/* Sound selector */}
          <div className="relative mb-4">
            <button
              onClick={() => setShowSoundMenu(!showSoundMenu)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-muted hover:bg-accent transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              {SOUNDS[sound]?.label || '经典滴滴'}
              <ChevronDown className={`w-3 h-3 transition-transform ${showSoundMenu ? 'rotate-180' : ''}`} />
            </button>
            {showSoundMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSoundMenu(false)} />
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                  {Object.entries(SOUNDS).map(([key, s]) => (
                    <button
                      key={key}
                      onClick={() => handleSoundChange(key)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center justify-between gap-3 ${
                        sound === key ? 'bg-accent/50' : ''
                      }`}
                    >
                      <span>{s.label}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePreviewSound(key) }}
                        className="p-0.5 rounded hover:bg-primary/10"
                        title="试听"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-3 justify-center">
            {status === 'idle' ? (
              <button onClick={handleStart}
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
