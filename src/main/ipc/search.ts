import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

interface SearchResult {
  chapter_id: number
  chapter_title: string
  volume_title: string | null
  snippet: string
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
}

export function registerSearchHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('search:all', (_e, novelId: number, query: string) => {
    const chapters = db.prepare(
      `SELECT c.id, c.title as chapter_title, c.content, v.title as volume_title
       FROM chapters c
       LEFT JOIN volumes v ON c.volume_id = v.id
       WHERE c.novel_id = ? AND c.content != ''
       ORDER BY v.sort_order, c.sort_order`
    ).all(novelId) as Array<{
      id: number
      chapter_title: string
      content: string
      volume_title: string | null
    }>

    const results: SearchResult[] = []
    const lowerQuery = query.toLowerCase()

    for (const ch of chapters) {
      const text = stripHtml(ch.content)
      const lowerText = text.toLowerCase()
      const idx = lowerText.indexOf(lowerQuery)
      if (idx === -1) continue

      const start = Math.max(0, idx - 40)
      const end = Math.min(text.length, idx + query.length + 40)
      let snippet = text.slice(start, end)
      if (start > 0) snippet = '...' + snippet
      if (end < text.length) snippet = snippet + '...'

      results.push({
        chapter_id: ch.id,
        chapter_title: ch.chapter_title,
        volume_title: ch.volume_title,
        snippet,
      })
    }

    return results
  })
}
