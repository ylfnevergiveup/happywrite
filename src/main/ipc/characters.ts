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

  ipc.handle('character:scanAppearances', (_e, novelId: number, characterName: string, aliases: string) => {
    const chapters = db.prepare(
      'SELECT id, title, content FROM chapters WHERE novel_id = ? ORDER BY sort_order'
    ).all(novelId) as Array<{ id: number; title: string; content: string }>

    // Build search terms: character name + comma-separated aliases
    const terms = [characterName, ...aliases.split(/[,，、]/).map((a) => a.trim()).filter(Boolean)]

    return chapters.map((ch) => {
      // Strip HTML tags to get plain text
      const plainText = ch.content.replace(/<[^>]*>/g, '')
      let totalCount = 0

      for (const term of terms) {
        if (!term) continue
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const matches = plainText.match(new RegExp(escaped, 'gi'))
        if (matches) totalCount += matches.length
      }

      // Normalize to 0-3 level
      let level = 0
      if (totalCount > 10) level = 3
      else if (totalCount > 3) level = 2
      else if (totalCount > 0) level = 1

      return {
        chapter_id: ch.id,
        chapter_title: ch.title,
        mention_count: totalCount,
        level,
      }
    })
  })

  ipc.handle('character:updateArcNodes', (_e, characterId: number, arcNodes: string) => {
    db.prepare(
      'UPDATE characters SET attributes = json_set(attributes, \'$.arc_nodes\', json(?)) WHERE id = ?'
    ).run(arcNodes, characterId)
    return db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId) as Character
  })
}
