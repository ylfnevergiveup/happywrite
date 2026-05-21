# Writing Productivity Features Design

> Three efficiency tools for daily writing: Pomodoro timer, goal dashboard, chapter drag-and-drop reorder.

**Goal:** Boost writing discipline and workflow efficiency with a timer, visual statistics, and draggable chapter list.

**Architecture:** All three features live entirely in the renderer process. The stats data layer (daily_stats table + stat IPC handlers) already exists — only UI work needed. Drag-and-drop reorder reuses the existing `chapter:reorder` IPC. The timer is new frontend-only state, persisted to `settings` for current-session resume.

**Tech Stack:** React + TipTap v2 + existing CSS variables/theming. New dependency: `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop.

---

## Feature 1: Writing Pomodoro Timer

A lightweight focus timer integrated into the editor status bar.

### Behavior

- Default durations: 25 / 45 / 60 minutes, selectable in the timer panel
- Countdown display with MM:SS format
- Three states: idle, running, paused
- On completion: system notification + bell sound (optional)
- Tracks words written during the session (delta from TipTap character count at start vs end)
- Auto-stops when switching to another chapter (optional: warn user)

### UI

- **Idle state:** "开始写作" button in WordCount status bar (right side, next to typewriter toggle)
- **Running state:** floating panel centered above editor, shows countdown + session word count + pause/stop buttons
- **Completed state:** brief summary overlay: "完成! 本次写作 1,234 字, 用时 45 分钟"

### Data

- Timer config (duration preference) stored in `settings` as `pomodoro_duration`
- Session word count recorded via existing `stat:recordWords` on session end
- No new database tables needed

---

## Feature 2: Goal Dashboard

Upgrade the existing StatsPanel (opened from WordCount bar) into a rich dashboard.

### Visual Elements

- **Ring progress chart:** circular progress showing today's words / daily goal percentage
- **Key metrics:** streak days, total novel word count, today's words
- **Weekly bar chart:** 7 columns (Mon-Sun), current day highlighted. Uses existing `weeklyStats` data.
- **Goal setter:** inline editable goal number, replaces current `prompt()` dialog

### UI

- Opens as a centered modal/overlay from the stats button in WordCount
- All data refreshes when the panel opens
- Click outside or press Escape to close

### Data

- All data comes from existing stat IPC: `todayWords`, `getDailyGoal`, `getStreak`, `weeklyStats`, `novel:wordCount`
- No new IPC needed

---

## Feature 3: Chapter Drag-and-Drop Reorder

Add drag-and-drop to the chapter sidebar inside NovelEditor.

### Behavior

- Each chapter item shows a drag handle (⠿ icon) on hover
- Dragging a chapter reorders within its volume
- Dragging a chapter between volumes moves it to the target volume (calls `chapter:moveToVolume`)
- On drop: call `chapter:reorder` with the new chapter ID order
- Optimistic UI update (update local state immediately, revert on IPC failure)

### Implementation

- Use `@dnd-kit/core` + `@dnd-kit/sortable` for accessible DnD
- Volume sections act as sortable containers
- Chapter items are sortable within their container
- Existing `chapter:reorder(chapterIds: number[])` IPC handles persistence

### UI

- Drag handle appears on chapter hover (⠿ icon, cursor: grab)
- Dragged item has reduced opacity (0.5) + slight elevation
- Drop indicator line appears between items to show insertion point
- Chapters show auto-numbering within their volume (章1, 章2...)

### Data

- Reuses `chapter:reorder` and `chapter:moveToVolume` IPC — no backend changes
