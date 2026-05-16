import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

interface Novel {
  id: number
  title: string
  description: string
  cover_path: string
  created_at: string
  updated_at: string
}

export function registerNovelHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('novel:list', () => {
    return db.prepare('SELECT * FROM novels ORDER BY updated_at DESC').all() as Novel[]
  })

  ipc.handle('novel:get', (_e, id: number) => {
    return db.prepare('SELECT * FROM novels WHERE id = ?').get(id) as Novel | undefined
  })

  ipc.handle('novel:create', (_e, data: { title: string; description?: string }) => {
    const stmt = db.prepare('INSERT INTO novels (title, description) VALUES (?, ?)')
    const result = stmt.run(data.title, data.description || '')
    return db.prepare('SELECT * FROM novels WHERE id = ?').get(result.lastInsertRowid) as Novel
  })

  ipc.handle('novel:update', (_e, id: number, data: Partial<Novel>) => {
    const fields = Object.keys(data)
      .filter((k) => k !== 'id' && k !== 'created_at')
      .map((k) => `${k} = @${k}`)
      .join(', ')
    const stmt = db.prepare(`UPDATE novels SET ${fields}, updated_at = datetime('now') WHERE id = @id`)
    stmt.run({ ...data, id })
    return db.prepare('SELECT * FROM novels WHERE id = ?').get(id) as Novel
  })

  ipc.handle('novel:delete', (_e, id: number) => {
    db.prepare('DELETE FROM novels WHERE id = ?').run(id)
  })

  ipc.handle('novel:wordCount', (_e, novelId: number) => {
    const row = db.prepare(
      'SELECT COALESCE(SUM(word_count), 0) as total FROM chapters WHERE novel_id = ?'
    ).get(novelId) as { total: number }
    return row.total
  })
}
