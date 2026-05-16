import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

interface Volume {
  id: number
  novel_id: number
  title: string
  sort_order: number
  created_at: string
}

export function registerVolumeHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('volume:listByNovel', (_e, novelId: number) => {
    return db.prepare(
      'SELECT * FROM volumes WHERE novel_id = ? ORDER BY sort_order'
    ).all(novelId) as Volume[]
  })

  ipc.handle('volume:create', (_e, data: { novel_id: number; title: string; sort_order?: number }) => {
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM volumes WHERE novel_id = ?'
    ).get(data.novel_id) as { max_order: number }
    const sortOrder = data.sort_order ?? maxOrder.max_order + 1

    const stmt = db.prepare('INSERT INTO volumes (novel_id, title, sort_order) VALUES (?, ?, ?)')
    const result = stmt.run(data.novel_id, data.title, sortOrder)
    return db.prepare('SELECT * FROM volumes WHERE id = ?').get(result.lastInsertRowid) as Volume
  })

  ipc.handle('volume:update', (_e, id: number, data: { title?: string; sort_order?: number }) => {
    if (data.title !== undefined) {
      db.prepare('UPDATE volumes SET title = ? WHERE id = ?').run(data.title, id)
    }
    if (data.sort_order !== undefined) {
      db.prepare('UPDATE volumes SET sort_order = ? WHERE id = ?').run(data.sort_order, id)
    }
    return db.prepare('SELECT * FROM volumes WHERE id = ?').get(id) as Volume
  })

  ipc.handle('volume:delete', (_e, id: number) => {
    db.prepare('UPDATE chapters SET volume_id = NULL WHERE volume_id = ?').run(id)
    db.prepare('DELETE FROM volumes WHERE id = ?').run(id)
  })

  ipc.handle('volume:reorder', (_e, volumeIds: number[]) => {
    const stmt = db.prepare('UPDATE volumes SET sort_order = ? WHERE id = ?')
    const txn = db.transaction(() => {
      volumeIds.forEach((id, index) => {
        stmt.run(index, id)
      })
    })
    txn()
  })
}
