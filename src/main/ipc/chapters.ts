import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

interface Chapter {
  id: number
  novel_id: number
  volume_id: number | null
  title: string
  content: string
  word_count: number
  word_target: number
  sort_order: number
  status: string
  notes: string
  created_at: string
  updated_at: string
}

function countWords(text: string): number {
  const chineseChars = (text.match(/[一-鿿]/g) || []).length
  const englishWords = text
    .replace(/[一-鿿]/g, '')
    .split(/\s+/)
    .filter(Boolean).length
  return chineseChars + englishWords
}

export function registerChapterHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('chapter:listByNovel', (_e, novelId: number) => {
    return db.prepare(
      `SELECT c.*, v.title as volume_title FROM chapters c
       LEFT JOIN volumes v ON c.volume_id = v.id
       WHERE c.novel_id = ?
       ORDER BY v.sort_order, c.sort_order`
    ).all(novelId)
  })

  ipc.handle('chapter:listByVolume', (_e, volumeId: number) => {
    return db.prepare(
      'SELECT * FROM chapters WHERE volume_id = ? ORDER BY sort_order'
    ).all(volumeId)
  })

  ipc.handle('chapter:get', (_e, id: number) => {
    return db.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as Chapter | undefined
  })

  ipc.handle('chapter:create', (_e, data: {
    novel_id: number
    volume_id?: number | null
    title: string
    content?: string
    sort_order?: number
  }) => {
    const content = data.content || ''
    const wordCount = countWords(content)
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM chapters WHERE novel_id = ?'
    ).get(data.novel_id) as { max_order: number }
    const sortOrder = data.sort_order ?? maxOrder.max_order + 1

    const stmt = db.prepare(
      'INSERT INTO chapters (novel_id, volume_id, title, content, word_count, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const result = stmt.run(data.novel_id, data.volume_id || null, data.title, content, wordCount, sortOrder)
    return db.prepare('SELECT * FROM chapters WHERE id = ?').get(result.lastInsertRowid) as Chapter
  })

  ipc.handle('chapter:update', (_e, id: number, data: Partial<Chapter>) => {
    if (data.content !== undefined) {
      data.word_count = countWords(data.content)
    }
    const fields = Object.keys(data)
      .filter((k) => k !== 'id' && k !== 'created_at' && k !== 'novel_id')
      .map((k) => `${k} = @${k}`)
      .join(', ')
    const stmt = db.prepare(`UPDATE chapters SET ${fields}, updated_at = datetime('now') WHERE id = @id`)
    stmt.run({ ...data, id })
    return db.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as Chapter
  })

  ipc.handle('chapter:delete', (_e, id: number) => {
    db.prepare('DELETE FROM chapters WHERE id = ?').run(id)
  })

  ipc.handle('chapter:reorder', (_e, chapterIds: number[]) => {
    const stmt = db.prepare('UPDATE chapters SET sort_order = ? WHERE id = ?')
    const txn = db.transaction(() => {
      chapterIds.forEach((id, index) => {
        stmt.run(index, id)
      })
    })
    txn()
  })

  ipc.handle('chapter:moveToVolume', (_e, chapterId: number, volumeId: number | null) => {
    db.prepare('UPDATE chapters SET volume_id = ? WHERE id = ?').run(volumeId, chapterId)
  })

  ipc.handle('chapter:updateNotes', (_e, chapterId: number, notes: string) => {
    db.prepare('UPDATE chapters SET notes = ?, updated_at = datetime(\'now\') WHERE id = ?').run(notes, chapterId)
  })

  ipc.handle('chapter:getNotes', (_e, chapterId: number) => {
    const row = db.prepare('SELECT notes FROM chapters WHERE id = ?').get(chapterId) as { notes: string } | undefined
    return row?.notes || ''
  })

  // ── Chapter history ──────────────────────────────────

  ipc.handle('chapter:saveHistory', (_e, chapterId: number, title: string, content: string, wordCount: number) => {
    db.prepare(
      'INSERT INTO chapter_history (chapter_id, title, content, word_count) VALUES (?, ?, ?, ?)'
    ).run(chapterId, title, content, wordCount)

    // Keep only last 20 versions per chapter
    const count = (db.prepare(
      'SELECT COUNT(*) as c FROM chapter_history WHERE chapter_id = ?'
    ).get(chapterId) as { c: number }).c

    if (count > 20) {
      const excess = count - 20
      db.prepare(
        `DELETE FROM chapter_history WHERE id IN (
          SELECT id FROM chapter_history WHERE chapter_id = ? ORDER BY saved_at ASC LIMIT ?
        )`
      ).run(chapterId, excess)
    }
  })

  ipc.handle('chapter:listHistory', (_e, chapterId: number) => {
    return db.prepare(
      'SELECT * FROM chapter_history WHERE chapter_id = ? ORDER BY saved_at DESC LIMIT 20'
    ).all(chapterId) as Array<{ id: number; chapter_id: number; title: string; content: string; word_count: number; saved_at: string }>
  })

  ipc.handle('chapter:getHistory', (_e, historyId: number) => {
    return db.prepare('SELECT * FROM chapter_history WHERE id = ?').get(historyId) as {
      id: number; chapter_id: number; title: string; content: string; word_count: number; saved_at: string
    } | undefined
  })

  ipc.handle('chapter:restoreHistory', (_e, historyId: number) => {
    const history = db.prepare('SELECT * FROM chapter_history WHERE id = ?').get(historyId) as {
      chapter_id: number; title: string; content: string; word_count: number
    } | undefined
    if (!history) return null

    db.prepare(
      `UPDATE chapters SET title = ?, content = ?, word_count = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(history.title, history.content, history.word_count, history.chapter_id)

    return db.prepare('SELECT * FROM chapters WHERE id = ?').get(history.chapter_id) as Chapter
  })
}

export { countWords }
