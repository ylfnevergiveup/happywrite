import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

interface OutlineNode {
  id: number
  novel_id: number
  parent_id: number | null
  title: string
  description: string
  type: string
  sort_order: number
  chapter_id: number | null
  created_at: string
  updated_at: string
}

export function registerOutlineHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('outline:listByNovel', (_e, novelId: number) => {
    return db.prepare(
      'SELECT * FROM outline_nodes WHERE novel_id = ? ORDER BY sort_order'
    ).all(novelId) as OutlineNode[]
  })

  ipc.handle('outline:get', (_e, id: number) => {
    return db.prepare('SELECT * FROM outline_nodes WHERE id = ?').get(id) as OutlineNode | undefined
  })

  ipc.handle('outline:create', (_e, data: {
    novel_id: number
    parent_id?: number | null
    title: string
    description?: string
    type?: string
    sort_order?: number
    chapter_id?: number | null
  }) => {
    const maxOrder = db.prepare(
      `SELECT COALESCE(MAX(sort_order), -1) as max_order FROM outline_nodes
       WHERE novel_id = ? AND parent_id IS ?`
    ).get(data.novel_id, data.parent_id || null) as { max_order: number }
    const sortOrder = data.sort_order ?? maxOrder.max_order + 1

    const stmt = db.prepare(
      `INSERT INTO outline_nodes (novel_id, parent_id, title, description, type, sort_order, chapter_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const result = stmt.run(
      data.novel_id, data.parent_id || null, data.title,
      data.description || '', data.type || 'scene', sortOrder, data.chapter_id || null
    )
    return db.prepare('SELECT * FROM outline_nodes WHERE id = ?').get(result.lastInsertRowid) as OutlineNode
  })

  ipc.handle('outline:update', (_e, id: number, data: Partial<OutlineNode>) => {
    const fields = Object.keys(data)
      .filter((k) => k !== 'id' && k !== 'created_at' && k !== 'novel_id')
      .map((k) => `${k} = @${k}`)
      .join(', ')
    const stmt = db.prepare(`UPDATE outline_nodes SET ${fields}, updated_at = datetime('now') WHERE id = @id`)
    stmt.run({ ...data, id })
    return db.prepare('SELECT * FROM outline_nodes WHERE id = ?').get(id) as OutlineNode
  })

  ipc.handle('outline:delete', (_e, id: number) => {
    db.prepare('DELETE FROM outline_nodes WHERE id = ?').run(id)
  })

  ipc.handle('outline:reorder', (_e, nodeIds: number[]) => {
    const stmt = db.prepare('UPDATE outline_nodes SET sort_order = ? WHERE id = ?')
    const txn = db.transaction(() => {
      nodeIds.forEach((id, index) => {
        stmt.run(index, id)
      })
    })
    txn()
  })

  ipc.handle('outline:moveToParent', (_e, nodeId: number, parentId: number | null) => {
    db.prepare('UPDATE outline_nodes SET parent_id = ? WHERE id = ?').run(parentId, nodeId)
  })

  ipc.handle('outline:linkToChapter', (_e, nodeId: number, chapterId: number | null) => {
    db.prepare('UPDATE outline_nodes SET chapter_id = ? WHERE id = ?').run(chapterId, nodeId)
  })
}
