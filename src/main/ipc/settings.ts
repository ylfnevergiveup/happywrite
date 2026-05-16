import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

export function registerSettingsHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('settings:get', (_e, key: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row ? JSON.parse(row.value) : null
  })

  ipc.handle('settings:set', (_e, key: string, value: unknown) => {
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, JSON.stringify(value))
  })

  ipc.handle('settings:delete', (_e, key: string) => {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  })

  ipc.handle('settings:getAll', () => {
    const rows = db.prepare('SELECT * FROM settings').all() as { key: string; value: string }[]
    const result: Record<string, unknown> = {}
    rows.forEach((row) => {
      result[row.key] = JSON.parse(row.value)
    })
    return result
  })
}
