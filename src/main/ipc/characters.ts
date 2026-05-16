import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

interface Character {
  id: number
  novel_id: number
  name: string
  aliases: string
  role: string
  description: string
  avatar_path: string
  attributes: string
  relationships: string
  created_at: string
  updated_at: string
}

export function registerCharacterHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('character:listByNovel', (_e, novelId: number) => {
    return db.prepare(
      'SELECT * FROM characters WHERE novel_id = ? ORDER BY name'
    ).all(novelId) as Character[]
  })

  ipc.handle('character:get', (_e, id: number) => {
    return db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as Character | undefined
  })

  ipc.handle('character:create', (_e, data: {
    novel_id: number
    name: string
    role?: string
    description?: string
    aliases?: string
    attributes?: string
    relationships?: string
  }) => {
    const stmt = db.prepare(
      `INSERT INTO characters (novel_id, name, role, description, aliases, attributes, relationships)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const result = stmt.run(
      data.novel_id, data.name, data.role || '', data.description || '',
      data.aliases || '', data.attributes || '{}', data.relationships || '[]'
    )
    return db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid) as Character
  })

  ipc.handle('character:update', (_e, id: number, data: Partial<Character>) => {
    const fields = Object.keys(data)
      .filter((k) => k !== 'id' && k !== 'created_at' && k !== 'novel_id')
      .map((k) => `${k} = @${k}`)
      .join(', ')
    const stmt = db.prepare(`UPDATE characters SET ${fields}, updated_at = datetime('now') WHERE id = @id`)
    stmt.run({ ...data, id })
    return db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as Character
  })

  ipc.handle('character:delete', (_e, id: number) => {
    db.prepare('DELETE FROM characters WHERE id = ?').run(id)
  })

  ipc.handle('character:search', (_e, novelId: number, query: string) => {
    return db.prepare(
      'SELECT * FROM characters WHERE novel_id = ? AND (name LIKE ? OR aliases LIKE ? OR description LIKE ?)'
    ).all(novelId, `%${query}%`, `%${query}%`, `%${query}%`) as Character[]
  })
}
