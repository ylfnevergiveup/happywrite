import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

export function registerStatHandlers(ipc: typeof ipcMain, db: Database.Database) {
  // Ensure daily_stats table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
      UNIQUE(novel_id, date)
    );
  `)

  ipc.handle('stat:todayWords', (_e, novelId: number) => {
    const today = new Date().toISOString().slice(0, 10)
    const row = db.prepare(
      'SELECT word_count FROM daily_stats WHERE novel_id = ? AND date = ?'
    ).get(novelId, today) as { word_count: number } | undefined
    return row?.word_count || 0
  })

  ipc.handle('stat:recordWords', (_e, novelId: number, wordCount: number) => {
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(
      `INSERT INTO daily_stats (novel_id, date, word_count) VALUES (?, ?, ?)
       ON CONFLICT(novel_id, date) DO UPDATE SET word_count = word_count + excluded.word_count`
    ).run(novelId, today, wordCount)
  })

  ipc.handle('stat:getDailyGoal', () => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'daily_goal'").get() as { value: string } | undefined
    return row ? parseInt(JSON.parse(row.value) as string, 10) || 0 : 0
  })

  ipc.handle('stat:setDailyGoal', (_e, goal: number) => {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('daily_goal', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(JSON.stringify(goal))
  })

  ipc.handle('stat:getStreak', (_e, novelId: number) => {
    const rows = db.prepare(
      `SELECT date, word_count FROM daily_stats
       WHERE novel_id = ? AND word_count > 0
       ORDER BY date DESC LIMIT 365`
    ).all(novelId) as Array<{ date: string; word_count: number }>

    if (rows.length === 0) return 0

    const goalRow = db.prepare("SELECT value FROM settings WHERE key = 'daily_goal'").get() as { value: string } | undefined
    const goal = goalRow ? parseInt(JSON.parse(goalRow.value) as string, 10) || 0 : 0

    let streak = 0
    const today = new Date()

    for (let i = 0; i < 365; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().slice(0, 10)
      const found = rows.find((r) => r.date === dateStr)
      if (found && (goal === 0 || found.word_count >= goal)) {
        streak++
      } else if (i > 0) {
        break
      }
    }
    return streak
  })

  ipc.handle('stat:weeklyStats', (_e, novelId: number) => {
    const result: Array<{ date: string; words: number }> = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().slice(0, 10)
      const row = db.prepare(
        'SELECT word_count FROM daily_stats WHERE novel_id = ? AND date = ?'
      ).get(novelId, dateStr) as { word_count: number } | undefined
      result.push({ date: dateStr, words: row?.word_count || 0 })
    }
    return result
  })
}
