import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

interface WorldSetting {
  id: number
  novel_id: number
  category: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export function registerWorldSettingHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('worldSetting:listByNovel', (_e, novelId: number) => {
    return db.prepare(
      'SELECT * FROM world_settings WHERE novel_id = ? ORDER BY category, title'
    ).all(novelId) as WorldSetting[]
  })

  ipc.handle('worldSetting:create', (_e, data: {
    novel_id: number
    category: string
    title: string
    content?: string
  }) => {
    const stmt = db.prepare(
      'INSERT INTO world_settings (novel_id, category, title, content) VALUES (?, ?, ?, ?)'
    )
    const result = stmt.run(data.novel_id, data.category, data.title, data.content || '')
    return db.prepare('SELECT * FROM world_settings WHERE id = ?').get(result.lastInsertRowid) as WorldSetting
  })

  ipc.handle('worldSetting:update', (_e, id: number, data: Partial<WorldSetting>) => {
    const fields = Object.keys(data)
      .filter((k) => k !== 'id' && k !== 'created_at' && k !== 'novel_id')
      .map((k) => `${k} = @${k}`)
      .join(', ')
    const stmt = db.prepare(`UPDATE world_settings SET ${fields}, updated_at = datetime('now') WHERE id = @id`)
    stmt.run({ ...data, id })
    return db.prepare('SELECT * FROM world_settings WHERE id = ?').get(id) as WorldSetting
  })

  ipc.handle('worldSetting:delete', (_e, id: number) => {
    db.prepare('DELETE FROM world_settings WHERE id = ?').run(id)
  })
}
