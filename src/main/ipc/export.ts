import { ipcMain, dialog, app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import Database from 'better-sqlite3'

interface ChapterData {
  title: string
  content: string
  volume_title?: string | null
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function registerExportHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('export:txt', async (_e, novelId: number, novelTitle: string) => {
    const result = await dialog.showSaveDialog({
      title: '导出 TXT',
      defaultPath: `${novelTitle}.txt`,
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    })

    if (result.canceled || !result.filePath) return { success: false, path: '' }

    const chapters = db.prepare(
      `SELECT c.title, c.content, v.title as volume_title
       FROM chapters c
       LEFT JOIN volumes v ON c.volume_id = v.id
       WHERE c.novel_id = ?
       ORDER BY v.sort_order, c.sort_order`
    ).all(novelId) as ChapterData[]

    let output = `${novelTitle}\n${'='.repeat(40)}\n\n`
    let currentVolume = ''

    for (const ch of chapters) {
      const volTitle = ch.volume_title || null
      if (volTitle && volTitle !== currentVolume) {
        currentVolume = volTitle
        output += `\n${'─'.repeat(30)}\n【${currentVolume}】\n${'─'.repeat(30)}\n\n`
      }
      output += `第${chapters.indexOf(ch) + 1}章 ${ch.title}\n${'─'.repeat(20)}\n\n`
      output += stripHtml(ch.content)
      output += '\n\n'
    }

    fs.writeFileSync(result.filePath, output, 'utf-8')
    return { success: true, path: result.filePath }
  })

  ipc.handle('export:epub', async (_e, novelId: number, novelTitle: string) => {
    const result = await dialog.showSaveDialog({
      title: '导出 EPUB',
      defaultPath: `${novelTitle}.epub`,
      filters: [{ name: 'EPUB Files', extensions: ['epub'] }],
    })

    if (result.canceled || !result.filePath) return { success: false, path: '' }

    const chapters = db.prepare(
      `SELECT c.title, c.content, v.title as volume_title
       FROM chapters c
       LEFT JOIN volumes v ON c.volume_id = v.id
       WHERE c.novel_id = ?
       ORDER BY v.sort_order, c.sort_order`
    ).all(novelId) as ChapterData[]

    const navPoints: string[] = []
    const htmlChapters: string[] = []
    let playOrder = 0

    for (const ch of chapters) {
      playOrder++
      const cleanContent = ch.content || ''
      const fileName = `chapter_${playOrder}.xhtml`

      navPoints.push(`
        <navPoint id="navpoint-${playOrder}" playOrder="${playOrder}">
          <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
          <content src="${fileName}"/>
        </navPoint>`)

      htmlChapters.push(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(ch.title)}</title></head>
<body>
  <h1>${escapeXml(ch.title)}</h1>
  ${cleanContent}
</body>
</html>`)
    }

    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`

    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(novelTitle)}</dc:title>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="book-id">happywrite-${novelId}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${chapters.map((_, i) => `<item id="chapter_${i + 1}" href="chapter_${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${chapters.map((_, i) => `<itemref idref="chapter_${i + 1}"/>`).join('\n    ')}
  </spine>
</package>`

    const ncxXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="happywrite-${novelId}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(novelTitle)}</text></docTitle>
  <navMap>
    ${navPoints.join('\n    ')}
  </navMap>
</ncx>`

    // Build EPUB (simple ZIP)
    const AdmZip = await import('adm-zip')
    const zip = new AdmZip.default()
    zip.addFile('mimetype', Buffer.from('application/epub+zip'), '', 0o644)
    zip.addFile('META-INF/container.xml', Buffer.from(containerXml, 'utf-8'))
    zip.addFile('content.opf', Buffer.from(opfXml, 'utf-8'))
    zip.addFile('toc.ncx', Buffer.from(ncxXml, 'utf-8'))
    htmlChapters.forEach((html, i) => {
      zip.addFile(`chapter_${i + 1}.xhtml`, Buffer.from(html, 'utf-8'))
    })

    fs.writeFileSync(result.filePath, zip.toBuffer())
    return { success: true, path: result.filePath }
  })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
