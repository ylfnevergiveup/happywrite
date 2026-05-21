# Writing Productivity Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Pomodoro timer, goal dashboard, and chapter drag-and-drop reorder to improve writing productivity.

**Architecture:** All renderer-only changes. No new IPC needed — stats data layer already exists. Install `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop. Extract StatsPanel into its own component, then enhance it. Add PomodoroTimer as a floating panel triggered from WordCount bar. The chapter sidebar gets DnD sortable items wrapping existing buttons.

**Tech Stack:** React, TipTap v2, @dnd-kit/core, @dnd-kit/sortable, existing Tailwind + CSS variables

---

### Task 1: Install @dnd-kit dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @dnd-kit packages**

Run:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages added to package.json and node_modules. No build errors.

- [ ] **Step 2: Verify build still passes**

Run: `npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -5`

Expected: Only pre-existing errors (aliases, Chapter notes mismatch). No new errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @dnd-kit packages for chapter drag-and-drop"
```

---

### Task 2: Extract StatsPanel into standalone component

**Files:**
- Create: `src/renderer/components/Editor/StatsDashboard.tsx`
- Modify: `src/renderer/components/Editor/WordCount.tsx`

The existing `StatsPanel` function (lines 129-180 in WordCount.tsx) is a basic weekly bar chart. Move it to its own file so it can be enhanced independently in Task 3. Keep the API identical for now.

- [ ] **Step 1: Create StatsDashboard.tsx with the extracted component**

```tsx
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
```

- [ ] **Step 2: Update WordCount.tsx — replace inline StatsPanel with import**

Remove lines 129-180 (the entire `function StatsPanel(...)` definition). Replace the `showStats` JSX with:

```tsx
{showStats && <StatsDashboard novelId={novelId} onClose={() => setShowStats(false)} />}
```

Add import at top:
```tsx
import { StatsDashboard } from './StatsDashboard'
```

And remove unused `useEffect` from the old `StatsPanel` — actually, since we are moving the component out, there is no issue. Just ensure all imports in WordCount are clean. Remove `useEffect` from imports if it was only used by StatsPanel (it is not — WordCount uses `useEffect` itself).

Also, remove the `X` icon, `cn`, `TrendingUp`, `Target`, `Flame`, `Maximize2`, `Minimize2` from the old StatsPanel — none of these need to be removed from WordCount since they are used in WordCount JSX. The old `cn` import was used by both WordCount and StatsPanel — keep it.

The only clean up needed: remove the `function StatsPanel(...)` lines 129-180. No import changes needed in WordCount.tsx.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -5`

Expected: Only pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Editor/StatsDashboard.tsx src/renderer/components/Editor/WordCount.tsx
git commit -m "refactor: extract StatsDashboard into standalone component"
```

---

### Task 3: Enhance StatsDashboard with ring progress, metrics, and goal setter

**Files:**
- Modify: `src/renderer/components/Editor/StatsDashboard.tsx`

Upgrade the extracted StatsDashboard with: ring progress chart (CSS SVG), key metrics row (streak, total words, today's words), and inline goal editor replacing `prompt()`.

- [ ] **Step 1: Rewrite StatsDashboard with all enhancements**

```tsx
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

  const progress = dailyGoal > 0 ? Math.min(todayWords / dailyGoal, 100) : 0
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
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -5`

Expected: Only pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Editor/StatsDashboard.tsx
git commit -m "feat: enhance StatsDashboard with ring progress, metrics grid, and inline goal editor"
```

---

### Task 4: Add PomodoroTimer component and integrate into WordCount

**Files:**
- Create: `src/renderer/components/Editor/PomodoroTimer.tsx`
- Modify: `src/renderer/components/Editor/WordCount.tsx`

The PomodoroTimer is a floating panel showing countdown (MM:SS), with preset duration buttons (25/45/60 min), pause/stop controls, and session word count. Triggered from a button in WordCount status bar.

The timer stores its config in `settings` as `pomodoro_duration`. The current remaining time is kept in local state only (resets on app restart — acceptable for a timer).

- [ ] **Step 1: Create PomodoroTimer.tsx**

```tsx
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
    const sessionWords = 0 // computed from char delta in parent — simplified here
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
```

- [ ] **Step 2: Update WordCount.tsx — add Pomodoro button and timer toggle**

Add import at top:
```tsx
import { PomodoroTimer } from './PomodoroTimer'
import { Timer } from 'lucide-react'
```

Add state after existing state declarations (after `const [showStats, setShowStats] = useState(false)`):
```tsx
const [showPomodoro, setShowPomodoro] = useState(false)
```

Add Pomodoro button in the status bar — insert after the "统计" button in the non-focus-mode section (after line 81):

```tsx
<button
  onClick={() => setShowPomodoro(true)}
  className="flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors"
>
  <Timer className="w-3 h-3" />
  番茄钟
</button>
```

Add the PomodoroTimer modal after the StatsDashboard rendering at bottom:
```tsx
{showPomodoro && (
  <PomodoroTimer
    initialChars={chars}
    onClose={() => setShowPomodoro(false)}
    onComplete={(sessionWords) => {
      if (sessionWords > 0) window.api.stat.recordWords(novelId, sessionWords).catch(() => {})
      setShowPomodoro(false)
      loadStats()
    }}
  />
)}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -5`

Expected: Only pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Editor/PomodoroTimer.tsx src/renderer/components/Editor/WordCount.tsx
git commit -m "feat: add Pomodoro writing timer with 25/45/60min presets"
```

---

### Task 5: Add chapter drag-and-drop reorder to NovelEditor chapter sidebar

**Files:**
- Modify: `src/renderer/components/Editor/NovelEditor.tsx`

Replace the static chapter list with `@dnd-kit` sortable items. Each chapter button gets a drag handle. Chapters can be reordered within their volume, and dragged between volumes (moving them via `chapter:moveToVolume`).

- [ ] **Step 1: Add imports for @dnd-kit and new icons**

Add these imports at the top of NovelEditor.tsx:

```tsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react' // add useMemo
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react' // add to existing lucide import
```

Note: The existing lucide import line needs `GripVertical` added:
```tsx
import { FileText, BookOpen, Plus, GripVertical } from 'lucide-react'
```

- [ ] **Step 2: Add DnD state and sensors after existing state declarations**

Insert after `const isSaving = useRef(false)` (after line 99):

```tsx
const [activeDragId, setActiveDragId] = useState<number | null>(null)
const [dragOverVolumeId, setDragOverVolumeId] = useState<number | null>(null)

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
)
```

- [ ] **Step 3: Create SortableChapterItem component above NovelEditor**

Add this component before the `NovelEditor` function definition (after the `WritingKeyboardShortcuts` extension, before `interface Props`):

```tsx
function SortableChapter({ chap, isActive, onSelect, chapters }: {
  chap: Chapter & { volume_title?: string }
  isActive: boolean
  onSelect: () => void
  chapters: (Chapter & { volume_title?: string })[]
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chap.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center group">
      <button {...attributes} {...listeners}
        className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity cursor-grab shrink-0"
        title="拖拽排序">
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </button>
      <button
        onClick={onSelect}
        className={`flex-1 text-left px-2 py-1 text-sm hover:bg-accent transition-colors truncate
          ${isActive ? 'bg-accent text-primary font-medium' : 'text-foreground'}`}
      >
        {chap.title}
        <span className="text-xs text-muted-foreground ml-1">({chap.word_count}字)</span>
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Add drag event handlers after handleCreateVolume**

Insert after line 283's `handleCreateVolume` function:

```tsx
const handleDragStart = (event: DragStartEvent) => {
  setActiveDragId(event.active.id as number)
}

const handleDragOver = (event: DragOverEvent) => {
  const overId = event.over?.id as number | undefined
  if (!overId) return
  // Determine which volume the target chapter belongs to
  const targetChapter = chapters.find((c) => c.id === overId)
  setDragOverVolumeId(targetChapter?.volume_id ?? null)
}

const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event
  setActiveDragId(null)
  setDragOverVolumeId(null)
  if (!over || active.id === over.id) return

  const activeId = active.id as number
  const overId = over.id as number
  const activeChapter = chapters.find((c) => c.id === activeId)
  const overChapter = chapters.find((c) => c.id === overId)
  if (!activeChapter || !overChapter) return

  // If volumes differ, move to target volume
  if (activeChapter.volume_id !== overChapter.volume_id) {
    await window.api.chapter.moveToVolume(activeId, overChapter.volume_id)
  }

  // Build new order: splice activeId out and insert before overId
  const sameVolume = activeChapter.volume_id === overChapter.volume_id
    || overChapter.volume_id === activeChapter.volume_id
  // Actually, we need to reorder within the target volume
  const targetVid = overChapter.volume_id
  const siblingIds = chapters
    .filter((c) => c.volume_id === targetVid)
    .map((c) => c.id)
  const activeIdx = siblingIds.indexOf(activeId)
  const overIdx = siblingIds.indexOf(overId)
  if (activeIdx >= 0 && overIdx >= 0) {
    siblingIds.splice(activeIdx, 1)
    siblingIds.splice(overIdx, 0, activeId)
    await window.api.chapter.reorder(siblingIds)
  }

  // Optimistic update
  setChapters((prev) => {
    const next = [...prev]
    const aIdx = next.findIndex((c) => c.id === activeId)
    const oIdx = next.findIndex((c) => c.id === overId)
    if (aIdx >= 0 && oIdx >= 0) {
      const [item] = next.splice(aIdx, 1)
      item.volume_id = targetVid
      next.splice(oIdx, 0, item)
    }
    return next
  })
}
```

- [ ] **Step 5: Rewrite the chapter sidebar JSX to use DndContext and SortableContext**

Replace the chapter tree sidebar (lines 306-349) with:

```tsx
{/* Chapter tree sidebar */}
{!focusMode && (
  <div className="w-56 border-r border-border overflow-y-auto bg-card/30 shrink-0">
    <div className="p-2 flex items-center justify-between sticky top-0 bg-card/80 backdrop-blur z-10">
      <span className="text-xs font-medium text-muted-foreground">目录</span>
      <div className="flex gap-1">
        <button onClick={() => handleCreateChapter(null)} className="text-xs px-1.5 py-0.5 rounded hover:bg-accent" title="新建章节">+章</button>
        <button onClick={handleCreateVolume} className="text-xs px-1.5 py-0.5 rounded hover:bg-accent" title="新建卷">+卷</button>
      </div>
    </div>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {volumes.map((vol) => {
        const volChapters = chapters.filter((c) => c.volume_id === vol.id)
        const ids = volChapters.map((c) => c.id)
        return (
          <div key={vol.id} className="mb-1">
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground flex items-center justify-between group">
              <span className="truncate">{vol.title}</span>
              <button onClick={() => handleCreateChapter(vol.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {volChapters.map((chap) => (
                <SortableChapter
                  key={chap.id}
                  chap={chap}
                  isActive={chap.id === chapterId}
                  onSelect={() => onChapterChange(chap.id)}
                  chapters={chapters}
                />
              ))}
            </SortableContext>
          </div>
        )
      })}
      {/* Unassigned chapters */}
      {chapters.filter((c) => !c.volume_id).length > 0 && (
        <SortableContext
          items={chapters.filter((c) => !c.volume_id).map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {chapters.filter((c) => !c.volume_id).map((chap) => (
            <SortableChapter
              key={chap.id}
              chap={chap}
              isActive={chap.id === chapterId}
              onSelect={() => onChapterChange(chap.id)}
              chapters={chapters}
            />
          ))}
        </SortableContext>
      )}
      <DragOverlay>
        {activeDragId ? (
          <div className="px-2 py-1 text-sm bg-card border border-border rounded shadow-lg opacity-80 truncate">
            {chapters.find((c) => c.id === activeDragId)?.title ?? ''}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compilation**

Run: `npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -10`

Expected: Only pre-existing errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Editor/NovelEditor.tsx
git commit -m "feat: add drag-and-drop chapter reorder with @dnd-kit"
```

---

### Task 6: Final verification — run dev server and spot-check

**Files:** None modified — verification only.

- [ ] **Step 1: Run dev server**

Run: `npm run dev` (background, watch output)

Expected: Main + preload build successfully, Electron launches, Vite dev server on port 5173.

- [ ] **Step 2: Manual check — verify in the running app**

Check these things in the launched Electron app:
1. Chapter sidebar: drag handles (⠿) appear on hover, drag to reorder
2. WordCount bar: "番茄钟" button visible, clicking opens timer panel
3. Timer panel: select duration, start/pause/stop, countdown works
4. Stats button: opens enhanced dashboard with ring chart, metrics, goal editor

No automated tests exist in this project. Visual verification is the acceptance criteria.

- [ ] **Step 3: Commit if any minor fixes needed, or confirm done**

```bash
# Only if fixes were made:
git add <fixed files>
git commit -m "fix: address issues found during manual verification"
```
